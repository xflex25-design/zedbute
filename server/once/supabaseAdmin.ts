import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mergeStoreStatuses } from "./store";
import type { ArtistProfile, StoreStatus } from "./types";

let adminClient: SupabaseClient | null | undefined = undefined;

export function normalizeValidSupabaseUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  let candidate = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!candidate) return null;
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    return null;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export function resolveServerSupabaseUrl(): string {
  return (
    normalizeValidSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeValidSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    "https://focothurmwepjqbyrtnn.supabase.co"
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;

  const url = resolveServerSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']+|["']+$/g, "");

  if (!url || !serviceRoleKey) {
    adminClient = null;
    return null;
  }

  try {
    adminClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return adminClient;
  } catch (err) {
    console.warn("[ONCE Supabase] Failed to initialize admin client:", err);
    adminClient = null;
    return null;
  }
}

export async function checkSupabaseWebhookDuplicate(dedupeKey: string): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client || !dedupeKey) return false;

  try {
    const { data, error } = await client
      .from("once_webhook_events")
      .select("id, processed")
      .eq("dedupe_key", dedupeKey)
      .eq("processed", true)
      .maybeSingle();

    if (error) {
      console.warn("[ONCE Supabase] Duplicate check query error:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn("[ONCE Supabase] Duplicate check exception:", err);
    return false;
  }
}

export async function recordSupabaseWebhookEvent(params: {
  eventType: string;
  onceReleaseId?: string;
  dedupeKey?: string;
  occurredAt?: string;
  processedAt?: string;
  signatureVerified: boolean;
  payload: Record<string, unknown>;
  processed: boolean;
  errorMessage?: string;
}): Promise<{ duplicateConflict: boolean }> {
  const client = getSupabaseAdmin();
  if (!client) return { duplicateConflict: false };

  try {
    const { error } = await client.from("once_webhook_events").insert({
      event_type: params.eventType,
      once_release_id: params.onceReleaseId ?? null,
      dedupe_key: params.dedupeKey ?? null,
      occurred_at: params.occurredAt ?? null,
      processed_at: params.processedAt ?? (params.processed ? new Date().toISOString() : null),
      signature_verified: params.signatureVerified,
      payload: params.payload,
      processed: params.processed,
      error_message: params.errorMessage ?? null,
    });

    if (error) {
      // PostgreSQL unique_violation on dedupe_key
      if (error.code === "23505") {
        return { duplicateConflict: true };
      }
      console.warn("[ONCE Supabase] Failed to insert webhook event:", error.message);
    }
    return { duplicateConflict: false };
  } catch (err) {
    console.warn("[ONCE Supabase] Exception inserting webhook event:", err);
    return { duplicateConflict: false };
  }
}

export function mapOnceStatusToZedbuteStatus(onceStatus: string): string {
  const normalized = (onceStatus || "").toLowerCase();
  switch (normalized) {
    case "live":
      return "live";
    case "distributed":
      return "distributed";
    case "delivered":
      return "delivered";
    case "approved":
      return "approved";
    case "processing":
    case "queued":
      return "processing";
    case "under_review":
      return "under_review";
    case "rejected":
    case "failed":
      return "rejected";
    case "taken_down":
      return "taken_down";
    default:
      return normalized || "processing";
  }
}

export async function syncReleaseWebhookUpdateToSupabase(params: {
  onceReleaseId: string;
  eventType: "release.status_changed" | "release.approved";
  status?: string;
  storeStatuses?: StoreStatus[];
  artistProfiles?: ArtistProfile[];
  upc?: string;
  tracks?: Array<{ isrc?: string; title?: string }>;
  occurredAt?: string;
}): Promise<{ found: boolean; releaseId?: string | null }> {
  const client = getSupabaseAdmin();
  if (!client) return { found: false };

  try {
    const { data: existing, error: fetchError } = await client
      .from("once_distribution_releases")
      .select("id, release_id, status, store_statuses, artist_profiles, metadata, upc, isrc, approved_at, distributed_at")
      .eq("once_release_id", params.onceReleaseId)
      .maybeSingle();

    if (fetchError) {
      console.warn("[ONCE Supabase] Error fetching release by once_release_id:", fetchError.message);
      return { found: false };
    }

    if (!existing) {
      return { found: false };
    }

    const now = new Date().toISOString();
    const eventTime = params.occurredAt || now;
    const mergedStores = Array.isArray(params.storeStatuses)
      ? mergeStoreStatuses((existing.store_statuses as StoreStatus[]) || [], params.storeStatuses)
      : (existing.store_statuses as StoreStatus[]) || [];

    const nextStatus =
      params.eventType === "release.approved"
        ? params.status || "approved"
        : params.status || existing.status;

    const existingMetadata = (existing.metadata as Record<string, unknown>) || {};
    const updatedMetadata = params.tracks
      ? { ...existingMetadata, approvedTracks: params.tracks }
      : existingMetadata;

    const updates: Record<string, unknown> = {
      status: nextStatus,
      store_statuses: mergedStores,
      metadata: updatedMetadata,
      updated_at: now,
    };

    if (Array.isArray(params.artistProfiles) && params.artistProfiles.length > 0) {
      updates.artist_profiles = params.artistProfiles;
    }
    if (params.upc) {
      updates.upc = params.upc;
    }
    if (params.tracks?.[0]?.isrc) {
      updates.isrc = params.tracks[0].isrc;
    }
    if (params.eventType === "release.approved" || (nextStatus === "approved" && !existing.approved_at)) {
      updates.approved_at = eventTime;
    }
    if ((nextStatus === "distributed" || nextStatus === "live") && !existing.distributed_at) {
      updates.distributed_at = eventTime;
    }

    const { error: updateError } = await client
      .from("once_distribution_releases")
      .update(updates)
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed updating once_distribution_releases: ${updateError.message}`);
    }

    // Also update linked Zedbute music_releases record if present
    if (existing.release_id) {
      const zedbuteStatus = mapOnceStatusToZedbuteStatus(nextStatus);
      const releaseUpdates: Record<string, unknown> = {
        status: zedbuteStatus,
        updated_at: now,
      };
      if (["approved", "delivered", "distributed", "live"].includes(zedbuteStatus)) {
        releaseUpdates.upload_progress = 100;
      }

      const { error: mrError } = await client
        .from("music_releases")
        .update(releaseUpdates)
        .eq("id", existing.release_id);

      if (mrError) {
        console.warn("[ONCE Supabase] Failed updating music_releases:", mrError.message);
      }
    }

    return { found: true, releaseId: existing.release_id };
  } catch (err) {
    console.error("[ONCE Supabase] Exception updating release from webhook:", err);
    throw err;
  }
}
