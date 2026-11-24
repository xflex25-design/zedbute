import crypto from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type NotificationType =
  | "release_status"
  | "payment_confirmation"
  | "once_submission"
  | "general";

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// In-memory fallback notification cache (for offline/testing resilience)
const inMemoryNotifications: NotificationRecord[] = [];

/**
 * Creates and persists a notification for an artist.
 * Attempts Supabase Admin first, falls back to internal memory store.
 */
export async function sendNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
}): Promise<NotificationRecord> {
  const notifType: NotificationType = params.type || "general";
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const record: NotificationRecord = {
    id,
    user_id: params.userId,
    title: params.title.trim(),
    message: params.message.trim(),
    type: notifType,
    is_read: false,
    created_at: now,
    metadata: params.metadata,
  };

  // Always keep in fallback memory cache
  inMemoryNotifications.unshift(record);
  if (inMemoryNotifications.length > 500) {
    inMemoryNotifications.pop();
  }

  const client = getSupabaseAdmin();
  if (client) {
    try {
      const { error } = await client.from("notifications").insert({
        id: record.id,
        user_id: record.user_id,
        title: record.title,
        message: record.message,
        type: record.type,
        is_read: false,
        created_at: record.created_at,
      });

      if (error) {
        console.warn("[Notifications] Failed inserting notification to Supabase:", error.message);
      }
    } catch (err) {
      console.warn("[Notifications] Exception inserting notification to Supabase:", err);
    }
  }

  return record;
}

/**
 * Sends a notification alerting the artist about a release status update
 * (e.g. approved, rejected, live, under review).
 */
export async function notifyReleaseStatusChange(params: {
  userId: string;
  releaseId?: string;
  releaseTitle: string;
  status: string;
  reason?: string;
  storeNames?: string[];
}): Promise<NotificationRecord> {
  const { userId, releaseId, releaseTitle, status, reason, storeNames } = params;
  const normalized = (status || "").toLowerCase();

  let title = `Release Status Updated: ${releaseTitle}`;
  let message = `The status of "${releaseTitle}" has changed to ${status}.`;

  switch (normalized) {
    case "approved":
      title = `Release Approved: ${releaseTitle}`;
      message = `Great news! "${releaseTitle}" has been approved by the distribution review team and is queued for global store delivery.`;
      break;
    case "rejected":
    case "failed":
      title = `Action Required: "${releaseTitle}" Needs Attention`;
      message = reason
        ? `Your release "${releaseTitle}" was rejected: ${reason}. Please update your metadata or audio in your dashboard.`
        : `Your release "${releaseTitle}" was rejected during ingestion. Please check metadata and quality requirements in your dashboard.`;
      break;
    case "live":
    case "distributed":
    case "delivered":
      title = `Live on Stores: ${releaseTitle}`;
      message = storeNames && storeNames.length > 0
        ? `"${releaseTitle}" is now live and streaming on ${storeNames.join(", ")} and 150+ stores worldwide!`
        : `"${releaseTitle}" is now live and streaming on Spotify, Apple Music, TikTok, Boomplay, and 150+ stores worldwide!`;
      break;
    case "under_review":
    case "in_review":
      title = `In Review: ${releaseTitle}`;
      message = `"${releaseTitle}" is currently undergoing audio fingerprinting and metadata review by our distribution team.`;
      break;
    case "processing":
    case "queued":
      title = `Processing: ${releaseTitle}`;
      message = `"${releaseTitle}" is being processed and packaged for DSP distribution.`;
      break;
  }

  return sendNotification({
    userId,
    title,
    message,
    type: "release_status",
    metadata: {
      release_id: releaseId,
      release_title: releaseTitle,
      status: normalized,
      reason,
    },
  });
}

/**
 * Sends a notification confirming an artist payment
 * (e.g. single upload K70, EP K200, Album K500, promotion K20, premium subscription).
 */
export async function notifyPaymentConfirmation(params: {
  userId: string;
  transactionId: string;
  paymentType: string;
  amountZmw: number;
  amountUsd?: number;
  releaseTitle?: string;
  plan?: string;
}): Promise<NotificationRecord> {
  const { userId, transactionId, paymentType, amountZmw, amountUsd, releaseTitle, plan } = params;
  const usdText = amountUsd ? ` (~$${amountUsd.toFixed(2)} USD)` : "";

  let title = `Payment Confirmed: K${amountZmw} Received`;
  let message = `Payment of K${amountZmw}${usdText} was successfully confirmed (Tx: ${transactionId}).`;

  if (paymentType === "release" || paymentType === "ep" || paymentType === "album" || paymentType === "single") {
    const item = releaseTitle ? `for "${releaseTitle}"` : "for your music release";
    title = `Payment Confirmed: ${releaseTitle || "Music Release"}`;
    message = `Payment of K${amountZmw}${usdText} ${item} was successfully confirmed (Tx: ${transactionId}). Your release is now submitted for distribution review.`;
  } else if (paymentType === "promotion") {
    title = `Promotion Payment Confirmed: K${amountZmw}`;
    message = `Payment of K${amountZmw}${usdText} for your release promotion was successfully confirmed (Tx: ${transactionId}). Your 7-day featured campaign has been activated.`;
  } else if (paymentType === "premium") {
    title = `Premium Subscription Confirmed: K${amountZmw}`;
    message = `Payment of K${amountZmw}${usdText} for your ${plan || "Premium"} plan was successfully confirmed (Tx: ${transactionId}). Premium distribution features are now being unlocked.`;
  }

  return sendNotification({
    userId,
    title,
    message,
    type: "payment_confirmation",
    metadata: {
      transaction_id: transactionId,
      payment_type: paymentType,
      amount_zmw: amountZmw,
      amount_usd: amountUsd,
      release_title: releaseTitle,
      plan,
    },
  });
}

/**
 * Sends a notification when a release is submitted to the ONCE distribution engine.
 */
export async function notifyOnceSubmission(params: {
  userId: string;
  releaseTitle: string;
  onceReleaseId: string;
}): Promise<NotificationRecord> {
  const { userId, releaseTitle, onceReleaseId } = params;

  return sendNotification({
    userId,
    title: `Submission Queued: ${releaseTitle}`,
    message: `"${releaseTitle}" has been submitted to the ONCE distribution network (Submission ID: ${onceReleaseId}). We will notify you once review is complete.`,
    type: "once_submission",
    metadata: {
      once_release_id: onceReleaseId,
      release_title: releaseTitle,
    },
  });
}

/**
 * Retrieves notifications for a given user.
 */
export async function getUserNotifications(userId: string): Promise<NotificationRecord[]> {
  const client = getSupabaseAdmin();
  if (client) {
    try {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as NotificationRecord[];
      }
    } catch (err) {
      console.warn("[Notifications] Failed reading notifications from Supabase:", err);
    }
  }

  // Fallback to memory store
  return inMemoryNotifications.filter((n) => n.user_id === userId);
}

/**
 * Marks a notification as read.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  // Update memory store
  const match = inMemoryNotifications.find((n) => n.id === notificationId && n.user_id === userId);
  if (match) {
    match.is_read = true;
  }

  const client = getSupabaseAdmin();
  if (client) {
    try {
      const { error } = await client
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);

      return !error;
    } catch (err) {
      console.warn("[Notifications] Failed updating notification read status:", err);
      return false;
    }
  }

  return true;
}

/**
 * Marks all notifications for a user as read.
 */
export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  for (const n of inMemoryNotifications) {
    if (n.user_id === userId) {
      n.is_read = true;
    }
  }

  const client = getSupabaseAdmin();
  if (client) {
    try {
      const { error } = await client
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId);

      return !error;
    } catch (err) {
      console.warn("[Notifications] Failed marking all notifications as read:", err);
      return false;
    }
  }

  return true;
}
