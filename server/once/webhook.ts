import type { Request, Response } from "express";
import { computePayloadDigest, verifyWebhookSignature } from "./crypto";
import { mergeStoreStatuses, onceStore } from "./store";
import {
  checkSupabaseWebhookDuplicate,
  recordSupabaseWebhookEvent,
  syncReleaseWebhookUpdateToSupabase,
} from "./supabaseAdmin";
import type { OnceWebhookPayload } from "./types";

const SUPPORTED_EVENTS = new Set(["release.status_changed", "release.approved"]);

// In-flight deduplication guard to prevent concurrent race conditions on simultaneous webhook retries
const inFlightDedupeKeys = new Set<string>();

function getSingleHeader(req: Request, name: string): string | undefined {
  const val = req.headers[name.toLowerCase()];
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length === 1 && typeof val[0] === "string") return val[0];
  return undefined;
}

export async function onceWebhookHandler(req: Request, res: Response) {
  const webhookSecret = process.env.ONCE_WEBHOOK_SECRET;

  // Fail closed: never process unverified webhook payloads when signing secret is unconfigured
  if (!webhookSecret) {
    console.error("[ONCE Webhook] ONCE_WEBHOOK_SECRET is not configured; rejecting request.");
    return res.status(503).json({
      error: "Webhook endpoint is not configured with a signing secret",
    });
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return res.status(400).json({ error: "Missing raw request body" });
  }

  const signatureHeader = getSingleHeader(req, "x-once-signature");
  const eventHeader = getSingleHeader(req, "x-once-event");
  const deliveryIdHeader = getSingleHeader(req, "x-once-delivery-id");

  // Step 1: Verify HMAC-SHA256 signature against exact raw body
  const isValidSignature = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValidSignature) {
    const safeEvent = eventHeader || (typeof req.body?.event === "string" ? req.body.event : "unknown");
    const safeReleaseId = typeof req.body?.releaseId === "string" ? req.body.releaseId : undefined;

    console.warn(`[ONCE Webhook] Rejected unverified payload (event=${safeEvent}, releaseId=${safeReleaseId ?? "n/a"})`);

    const rejectedPayloadSummary = { rejectedReason: "invalid_signature" };

    onceStore.logWebhookEvent({
      eventType: safeEvent,
      onceReleaseId: safeReleaseId,
      signatureVerified: false,
      payload: rejectedPayloadSummary,
      processed: false,
      errorMessage: "Invalid or missing x-once-signature",
    });

    await recordSupabaseWebhookEvent({
      eventType: safeEvent,
      onceReleaseId: safeReleaseId,
      signatureVerified: false,
      payload: rejectedPayloadSummary,
      processed: false,
      errorMessage: "Invalid or missing x-once-signature",
    });

    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  // Step 2: Validate JSON payload structure
  const payload = req.body as Partial<OnceWebhookPayload> | null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "Invalid JSON webhook payload" });
  }

  const eventType = eventHeader || payload.event;
  if (!eventType || typeof eventType !== "string") {
    return res.status(400).json({ error: "Missing webhook event type" });
  }

  if (!SUPPORTED_EVENTS.has(eventType)) {
    // Acknowledge unknown future events after valid signature check so ONCE does not disable endpoint
    onceStore.logWebhookEvent({
      eventType,
      onceReleaseId: typeof payload.releaseId === "string" ? payload.releaseId : undefined,
      occurredAt: typeof payload.occurredAt === "string" ? payload.occurredAt : undefined,
      signatureVerified: true,
      payload: payload as Record<string, unknown>,
      processed: true,
      errorMessage: "Ignored unsupported event type",
    });
    return res.status(200).json({ received: true, ignored: true, event: eventType });
  }

  if (!payload.releaseId || typeof payload.releaseId !== "string") {
    return res.status(400).json({ error: "Missing releaseId in webhook payload" });
  }

  // Step 3: Prevent duplicate event processing (idempotency & safe retry handling)
  const payloadDigest = computePayloadDigest(rawBody);
  const dedupeKey = deliveryIdHeader ? `${deliveryIdHeader}:${payloadDigest}` : payloadDigest;

  if (inFlightDedupeKeys.has(dedupeKey)) {
    return res.status(200).json({ received: true, duplicate: true, inFlight: true });
  }

  const alreadyProcessedLocal = onceStore.hasProcessedWebhookEvent(dedupeKey);
  const alreadyProcessedDb = alreadyProcessedLocal ? true : await checkSupabaseWebhookDuplicate(dedupeKey);

  if (alreadyProcessedLocal || alreadyProcessedDb) {
    return res.status(200).json({
      received: true,
      duplicate: true,
      onceReleaseId: payload.releaseId,
    });
  }

  inFlightDedupeKeys.add(dedupeKey);

  try {
    const now = new Date().toISOString();
    const occurredAt =
      typeof payload.occurredAt === "string" && !Number.isNaN(Date.parse(payload.occurredAt))
        ? payload.occurredAt
        : now;

    // Step 4: Identify local release by ONCE release ID and merge updates
    const localRelease = onceStore.getReleaseByOnceId(payload.releaseId);
    let localMatched = false;

    if (localRelease) {
      localMatched = true;
      const updates: Record<string, unknown> = {};

      if (typeof payload.status === "string" && payload.status.length > 0) {
        updates.status = payload.status;
      }

      if (Array.isArray(payload.storeStatuses)) {
        updates.store_statuses = mergeStoreStatuses(
          localRelease.store_statuses || [],
          payload.storeStatuses
        );
      }

      if (Array.isArray(payload.artistProfiles) && payload.artistProfiles.length > 0) {
        updates.artist_profiles = payload.artistProfiles;
      }

      if (typeof payload.upc === "string" && payload.upc.length > 0) {
        updates.upc = payload.upc;
      }

      if (Array.isArray(payload.tracks)) {
        if (payload.tracks[0]?.isrc) {
          updates.isrc = payload.tracks[0].isrc;
        }
        updates.metadata = {
          ...(localRelease.metadata || {}),
          approvedTracks: payload.tracks,
        };
      }

      if (eventType === "release.approved") {
        updates.status = typeof payload.status === "string" && payload.status ? payload.status : "approved";
        updates.approved_at = occurredAt;
      }

      if (updates.status === "distributed" || updates.status === "live") {
        updates.distributed_at = occurredAt;
      } else if (updates.status === "approved" && !localRelease.approved_at) {
        updates.approved_at = occurredAt;
      }

      onceStore.updateRelease(localRelease.id, updates);
    }

    // Step 5: Sync updates to Supabase Zedbute database (if configured)
    const dbSyncResult = await syncReleaseWebhookUpdateToSupabase({
      onceReleaseId: payload.releaseId,
      eventType: eventType as "release.status_changed" | "release.approved",
      status: typeof payload.status === "string" ? payload.status : undefined,
      storeStatuses: Array.isArray(payload.storeStatuses) ? payload.storeStatuses : undefined,
      artistProfiles: Array.isArray(payload.artistProfiles) ? payload.artistProfiles : undefined,
      upc: typeof payload.upc === "string" ? payload.upc : undefined,
      tracks: Array.isArray(payload.tracks) ? payload.tracks : undefined,
      occurredAt,
    });

    const processedAt = new Date().toISOString();

    // Step 6: Record verified webhook event with timestamps
    const dbEventResult = await recordSupabaseWebhookEvent({
      eventType,
      onceReleaseId: payload.releaseId,
      dedupeKey,
      occurredAt,
      processedAt,
      signatureVerified: true,
      payload: payload as Record<string, unknown>,
      processed: true,
    });

    if (dbEventResult.duplicateConflict) {
      return res.status(200).json({
        received: true,
        duplicate: true,
        onceReleaseId: payload.releaseId,
      });
    }

    onceStore.logWebhookEvent({
      eventType,
      onceReleaseId: payload.releaseId,
      dedupeKey,
      occurredAt,
      processedAt,
      signatureVerified: true,
      payload: payload as Record<string, unknown>,
      processed: true,
    });

    return res.status(200).json({
      received: true,
      event: eventType,
      onceReleaseId: payload.releaseId,
      matched: localMatched || dbSyncResult.found,
      processedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal processing error";
    console.error("[ONCE Webhook] Error processing verified webhook:", message);

    onceStore.logWebhookEvent({
      eventType,
      onceReleaseId: payload.releaseId,
      dedupeKey,
      occurredAt: typeof payload.occurredAt === "string" ? payload.occurredAt : undefined,
      signatureVerified: true,
      payload: payload as Record<string, unknown>,
      processed: false,
      errorMessage: message,
    });

    return res.status(500).json({ error: "Failed to process webhook notification" });
  } finally {
    inFlightDedupeKeys.delete(dedupeKey);
  }
}
