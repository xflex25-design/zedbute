import type { Request, Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto";
import { onceStore } from "./store";
import { getSupabaseAdmin, resolveServerSupabaseUrl } from "./supabaseAdmin";
import type { OnceDistributionReleaseRecord } from "./types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuthenticatedZedbuteUser {
  id: string;
  email?: string;
  jwt: string;
  isAdmin: boolean;
  dbClient: SupabaseClient;
}

function getSupabaseServerConfig(): { url: string; key: string } | null {
  const url = resolveServerSupabaseUrl();
  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const key = rawKey?.trim().replace(/^["']+|["']+$/g, "");

  if (!url || !key || key === "placeholder-anon-key") {
    return null;
  }
  return { url, key };
}

function createUserScopedClient(url: string, key: string, jwt: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

export async function authenticateRequest(req: Request): Promise<
  | { ok: true; user: AuthenticatedZedbuteUser }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return { ok: false, status: 401, error: "Missing bearer session token" };
  }

  const config = getSupabaseServerConfig();
  if (!config) {
    return {
      ok: false,
      status: 503,
      error: "Server authentication requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)",
    };
  }

  let authClient: SupabaseClient;
  let dbClient: SupabaseClient;
  try {
    authClient =
      getSupabaseAdmin() ||
      createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    dbClient = getSupabaseAdmin() || createUserScopedClient(config.url, config.key, jwt);
  } catch (err: any) {
    console.error("[ONCE Auth] Supabase client initialization error:", err?.message || err);
    return {
      ok: false,
      status: 503,
      error: "Server authentication configuration error (invalid Supabase URL or key)",
    };
  }

  const { data, error } = await authClient.auth.getUser(jwt);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Invalid or expired user session" };
  }

  let isAdmin = false;
  try {
    const { data: roles } = await dbClient
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    isAdmin = Boolean(roles?.some((r: { role?: string }) => r.role === "admin"));
  } catch {
    isAdmin = false;
  }

  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      jwt,
      isAdmin,
      dbClient,
    },
  };
}

export async function requireAuthenticatedUser(
  req: Request,
  res: Response
): Promise<AuthenticatedZedbuteUser | null> {
  const result = await authenticateRequest(req);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return null;
  }
  return result.user;
}

export async function requireAdminUser(
  req: Request,
  res: Response
): Promise<AuthenticatedZedbuteUser | null> {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!user.isAdmin) {
    res.status(403).json({ error: "Administrator access required" });
    return null;
  }
  return user;
}

export async function resolveOnceTokenForUser(
  userId: string,
  dbClient?: SupabaseClient
): Promise<{ token: string; isDedicatedUserToken: boolean }> {
  const localAccount = onceStore.getAccount(userId);
  if (localAccount?.encryptedAccessToken) {
    const decrypted = decryptToken(localAccount.encryptedAccessToken);
    if (decrypted) {
      return { token: decrypted, isDedicatedUserToken: true };
    }
  }

  if (dbClient) {
    try {
      const { data } = await dbClient
        .from("once_accounts")
        .select("encrypted_access_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (data?.encrypted_access_token) {
        const decrypted = decryptToken(data.encrypted_access_token);
        if (decrypted) {
          return { token: decrypted, isDedicatedUserToken: true };
        }
      }
    } catch {
      // Fall through to partner token if configured
    }
  }

  return {
    token: process.env.ONCE_ACCESS_TOKEN || "",
    isDedicatedUserToken: false,
  };
}

function normalizeDbRelease(row: Record<string, unknown>): OnceDistributionReleaseRecord {
  return {
    id: String(row.id),
    release_id: row.release_id ? String(row.release_id) : undefined,
    user_id: String(row.user_id),
    once_release_id: row.once_release_id ? String(row.once_release_id) : undefined,
    once_draft_id: row.once_draft_id ? String(row.once_draft_id) : undefined,
    title: String(row.title || "Untitled"),
    primary_artist: String(row.primary_artist || "Unknown Artist"),
    release_type: String(row.release_type || "single"),
    upc: row.upc ? String(row.upc) : undefined,
    isrc: row.isrc ? String(row.isrc) : undefined,
    cover_art_url: row.cover_art_url ? String(row.cover_art_url) : undefined,
    audio_url: row.audio_url ? String(row.audio_url) : undefined,
    metadata: (row.metadata as Record<string, unknown>) || {},
    distribution_store_ids: Array.isArray(row.distribution_store_ids)
      ? (row.distribution_store_ids as number[])
      : [],
    store_statuses: Array.isArray(row.store_statuses) ? row.store_statuses : [],
    artist_profiles: Array.isArray(row.artist_profiles) ? row.artist_profiles : [],
    status: String(row.status || "draft"),
    is_ai_detected: Boolean(row.is_ai_detected),
    ai_score: typeof row.ai_score === "number" ? row.ai_score : undefined,
    predicted_ai_model: row.predicted_ai_model ? String(row.predicted_ai_model) : undefined,
    acr_matched: Boolean(row.acr_matched),
    acr_best_match: row.acr_best_match as OnceDistributionReleaseRecord["acr_best_match"],
    credit_cost: typeof row.credit_cost === "number" ? row.credit_cost : 1,
    credits_debited: typeof row.credits_debited === "number" ? row.credits_debited : 0,
    exchange_rate_snapshot: ((row.metadata as Record<string, unknown>)?.exchangeRateSnapshot as OnceDistributionReleaseRecord["exchange_rate_snapshot"]) || null,
    submission_error: row.submission_error ? String(row.submission_error) : undefined,
    submitted_at: row.submitted_at ? String(row.submitted_at) : undefined,
    approved_at: row.approved_at ? String(row.approved_at) : undefined,
    distributed_at: row.distributed_at ? String(row.distributed_at) : undefined,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

function deduplicateReleases(records: OnceDistributionReleaseRecord[]): OnceDistributionReleaseRecord[] {
  const map = new Map<string, OnceDistributionReleaseRecord>();
  for (const r of records) {
    const key = r.once_release_id || r.id;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      // Prefer the more recently updated record
      const existingTime = Date.parse(existing.updated_at || "") || 0;
      const candidateTime = Date.parse(r.updated_at || "") || 0;
      if (candidateTime >= existingTime) {
        map.set(key, r);
      }
    }
  }
  return Array.from(map.values());
}

export async function getUserOwnedReleases(
  authUser: AuthenticatedZedbuteUser
): Promise<OnceDistributionReleaseRecord[]> {
  const localOwned = onceStore.listReleases(authUser.id);
  let dbOwned: OnceDistributionReleaseRecord[] = [];

  try {
    const { data, error } = await authUser.dbClient
      .from("once_distribution_releases")
      .select("*")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      dbOwned = data.map((row) => normalizeDbRelease(row as Record<string, unknown>));
    }
  } catch {
    // Use local store records if Supabase query fails
  }

  return deduplicateReleases([...localOwned, ...dbOwned]);
}

export async function getVerifiedOwnedRelease(
  releaseIdOrOnceId: string,
  authUser: AuthenticatedZedbuteUser
): Promise<
  | { ok: true; release: OnceDistributionReleaseRecord }
  | { ok: false; status: number; error: string }
> {
  const targetId = releaseIdOrOnceId.trim();
  if (!targetId) {
    return { ok: false, status: 400, error: "Release ID is required" };
  }

  // 1. Check local engine store
  const localMatch = onceStore.getRelease(targetId) || onceStore.getReleaseByOnceId(targetId);
  if (localMatch) {
    if (localMatch.user_id !== authUser.id) {
      return { ok: false, status: 403, error: "You do not have permission to view analytics for this release" };
    }
    return { ok: true, release: localMatch };
  }

  // 2. Check Supabase once_distribution_releases (using admin if available to distinguish 403 vs 404 safely)
  const reader = getSupabaseAdmin() || authUser.dbClient;
  try {
    let matchedRow: Record<string, unknown> | null = null;

    if (UUID_REGEX.test(targetId)) {
      const { data: byId } = await reader
        .from("once_distribution_releases")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();
      if (byId) matchedRow = byId as Record<string, unknown>;

      if (!matchedRow) {
        const { data: byMusicReleaseId } = await reader
          .from("once_distribution_releases")
          .select("*")
          .eq("release_id", targetId)
          .maybeSingle();
        if (byMusicReleaseId) matchedRow = byMusicReleaseId as Record<string, unknown>;
      }
    }

    if (!matchedRow) {
      const { data: byOnceId } = await reader
        .from("once_distribution_releases")
        .select("*")
        .eq("once_release_id", targetId)
        .maybeSingle();
      if (byOnceId) matchedRow = byOnceId as Record<string, unknown>;
    }

    if (!matchedRow) {
      return { ok: false, status: 403, error: "Release not found or not owned by your account" };
    }

    const normalized = normalizeDbRelease(matchedRow);
    if (normalized.user_id !== authUser.id) {
      return { ok: false, status: 403, error: "You do not have permission to view analytics for this release" };
    }

    return { ok: true, release: normalized };
  } catch {
    return { ok: false, status: 403, error: "Release access verification failed" };
  }
}

export async function getAllManagedReleases(
  authUser: AuthenticatedZedbuteUser
): Promise<OnceDistributionReleaseRecord[]> {
  if (!authUser.isAdmin) {
    return [];
  }

  const localAll = onceStore.listReleases();
  let dbAll: OnceDistributionReleaseRecord[] = [];
  const reader = getSupabaseAdmin() || authUser.dbClient;

  try {
    const { data, error } = await reader
      .from("once_distribution_releases")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      dbAll = data.map((row) => normalizeDbRelease(row as Record<string, unknown>));
    }
  } catch {
    // Use local records if Supabase query fails
  }

  return deduplicateReleases([...localAll, ...dbAll]);
}
