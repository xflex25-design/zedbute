import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type {
  ExchangeRateSnapshot,
  OnceDistributionReleaseRecord,
  OnceEngineSettingsRecord,
  OnceAuditLogRecord,
  StoreStatus,
  ZedbuteFinancialTransactionRecord,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "once_engine_data.json");

interface OnceStoreData {
  accounts: Record<string, {
    id: string;
    userId: string;
    onceAccountId?: string;
    encryptedAccessToken?: string;
    encryptedRefreshToken?: string;
    tokenExpiresAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  releases: Record<string, OnceDistributionReleaseRecord>;
  webhooks: Array<{
    id: string;
    eventType: string;
    onceReleaseId?: string;
    dedupeKey?: string;
    occurredAt?: string;
    processedAt?: string;
    signatureVerified?: boolean;
    payload: Record<string, unknown>;
    processed: boolean;
    errorMessage?: string;
    createdAt: string;
  }>;
  auditLogs: OnceAuditLogRecord[];
  settings: OnceEngineSettingsRecord;
  exchangeRateCache: ExchangeRateSnapshot | null;
  financialTransactions: ZedbuteFinancialTransactionRecord[];
}

const defaultData: OnceStoreData = {
  accounts: {},
  releases: {},
  webhooks: [],
  auditLogs: [],
  settings: {
    id: "default",
    auto_distribute_default: false,
    require_admin_approval: true,
    single_upload_price_zmw: 70,
    updated_at: new Date().toISOString(),
  },
  exchangeRateCache: null,
  financialTransactions: [],
};

function ensureDataFile(): OnceStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf8");
      return { ...defaultData };
    }
    const content = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(content) as Partial<OnceStoreData>;
    return {
      accounts: parsed.accounts || {},
      releases: parsed.releases || {},
      webhooks: Array.isArray(parsed.webhooks) ? parsed.webhooks : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      settings: parsed.settings || defaultData.settings,
      exchangeRateCache: parsed.exchangeRateCache || null,
      financialTransactions: Array.isArray(parsed.financialTransactions)
        ? parsed.financialTransactions
        : [],
    };
  } catch (err) {
    console.error("[ONCE Store] Error reading data file:", err);
    return { ...defaultData };
  }
}

function persistData(data: OnceStoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[ONCE Store] Error persisting data file:", err);
  }
}

export function mergeStoreStatuses(
  existing: StoreStatus[] = [],
  incoming: StoreStatus[] = []
): StoreStatus[] {
  const byStoreId = new Map<number, StoreStatus>();
  for (const s of existing) {
    if (s && typeof s.storeId === "number") {
      byStoreId.set(s.storeId, s);
    }
  }
  for (const s of incoming) {
    if (s && typeof s.storeId === "number") {
      const prev = byStoreId.get(s.storeId);
      byStoreId.set(s.storeId, { ...prev, ...s });
    }
  }
  return Array.from(byStoreId.values());
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function syncReleaseToSupabase(record: OnceDistributionReleaseRecord): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !UUID_REGEX.test(record.user_id) || !UUID_REGEX.test(record.id)) return;
  try {
    await supabase.from("once_distribution_releases").upsert(
      {
        id: record.id,
        release_id: record.release_id && UUID_REGEX.test(record.release_id) ? record.release_id : null,
        user_id: record.user_id,
        once_release_id: record.once_release_id || null,
        once_draft_id: record.once_draft_id || null,
        title: record.title,
        primary_artist: record.primary_artist,
        release_type: record.release_type,
        upc: record.upc || null,
        isrc: record.isrc || null,
        cover_art_url: record.cover_art_url || null,
        audio_url: record.audio_url || null,
        metadata: record.exchange_rate_snapshot
          ? { ...(record.metadata || {}), exchangeRateSnapshot: record.exchange_rate_snapshot }
          : record.metadata || {},
        distribution_store_ids: record.distribution_store_ids || [],
        store_statuses: record.store_statuses || [],
        artist_profiles: record.artist_profiles || [],
        status: record.status,
        is_ai_detected: Boolean(record.is_ai_detected),
        ai_score: record.ai_score ?? null,
        predicted_ai_model: record.predicted_ai_model || null,
        acr_matched: Boolean(record.acr_matched),
        acr_best_match: record.acr_best_match ?? null,
        credit_cost: record.credit_cost || 1,
        credits_debited: record.credits_debited || 0,
        submission_error: record.submission_error || null,
        validation_errors: record.validation_errors || [],
        current_step: record.current_step || 1,
        last_quote: record.last_quote ?? null,
        reviewed_by: record.reviewed_by || null,
        reviewed_at: record.reviewed_at || null,
        review_notes: record.review_notes || null,
        submitted_at: record.submitted_at || null,
        approved_at: record.approved_at || null,
        distributed_at: record.distributed_at || null,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
      { onConflict: "id" }
    );
  } catch (err) {
    console.warn("[ONCE Store] Supabase release sync notice:", err instanceof Error ? err.message : String(err));
  }
}

export const onceStore = {
  // --- Accounts ---
  saveAccount(userId: string, data: {
    onceAccountId?: string;
    encryptedAccessToken?: string;
    encryptedRefreshToken?: string;
    tokenExpiresAt?: string;
  }) {
    const store = ensureDataFile();
    const existing = store.accounts[userId];
    const now = new Date().toISOString();
    store.accounts[userId] = {
      id: existing?.id || crypto.randomUUID(),
      userId,
      onceAccountId: data.onceAccountId || existing?.onceAccountId,
      encryptedAccessToken: data.encryptedAccessToken || existing?.encryptedAccessToken,
      encryptedRefreshToken: data.encryptedRefreshToken || existing?.encryptedRefreshToken,
      tokenExpiresAt: data.tokenExpiresAt || existing?.tokenExpiresAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    persistData(store);
    return store.accounts[userId];
  },

  getAccount(userId: string) {
    const store = ensureDataFile();
    return store.accounts[userId] || null;
  },

  // --- Releases ---
  createRelease(record: Partial<OnceDistributionReleaseRecord> & {
    userId: string;
    title: string;
    primaryArtist: string;
  }): OnceDistributionReleaseRecord {
    const store = ensureDataFile();
    const id = record.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const newRelease: OnceDistributionReleaseRecord = {
      id,
      release_id: record.release_id,
      user_id: record.userId,
      once_release_id: record.once_release_id,
      once_draft_id: record.once_draft_id,
      title: record.title,
      primary_artist: record.primaryArtist,
      release_type: record.release_type || "single",
      upc: record.upc,
      isrc: record.isrc,
      cover_art_url: record.cover_art_url,
      audio_url: record.audio_url,
      metadata: record.metadata || {},
      distribution_store_ids: record.distribution_store_ids || [1, 9, 13, 319],
      store_statuses: record.store_statuses || [],
      artist_profiles: record.artist_profiles || [],
      status: record.status || "draft",
      is_ai_detected: record.is_ai_detected || false,
      ai_score: record.ai_score,
      predicted_ai_model: record.predicted_ai_model,
      acr_matched: record.acr_matched || false,
      acr_best_match: record.acr_best_match,
      credit_cost: record.credit_cost || 1,
      credits_debited: record.credits_debited || 0,
      submission_error: record.submission_error,
      validation_errors: record.validation_errors || [],
      current_step: record.current_step || 1,
      last_quote: record.last_quote ?? null,
      exchange_rate_snapshot: record.exchange_rate_snapshot ?? null,
      amount_zmw: record.amount_zmw,
      processing_fee_zmw: record.processing_fee_zmw,
      reviewed_by: record.reviewed_by,
      reviewed_at: record.reviewed_at,
      review_notes: record.review_notes,
      submitted_at: record.submitted_at,
      approved_at: record.approved_at,
      distributed_at: record.distributed_at,
      created_at: record.created_at || now,
      updated_at: now,
    };

    store.releases[id] = newRelease;
    persistData(store);
    void syncReleaseToSupabase(newRelease);
    return newRelease;
  },

  updateRelease(id: string, updates: Partial<OnceDistributionReleaseRecord>): OnceDistributionReleaseRecord | null {
    const store = ensureDataFile();
    const existing = store.releases[id];
    if (!existing) return null;

    const updated: OnceDistributionReleaseRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    store.releases[id] = updated;
    persistData(store);
    void syncReleaseToSupabase(updated);
    return updated;
  },

  updateReleaseByOnceId(onceReleaseId: string, updates: Partial<OnceDistributionReleaseRecord>): OnceDistributionReleaseRecord | null {
    const store = ensureDataFile();
    const release = Object.values(store.releases).find((r) => r.once_release_id === onceReleaseId);
    if (!release) return null;
    return this.updateRelease(release.id, updates);
  },

  getRelease(id: string): OnceDistributionReleaseRecord | null {
    const store = ensureDataFile();
    return store.releases[id] || null;
  },

  getReleaseByOnceId(onceReleaseId: string): OnceDistributionReleaseRecord | null {
    const store = ensureDataFile();
    return Object.values(store.releases).find((r) => r.once_release_id === onceReleaseId) || null;
  },

  listReleases(userId?: string): OnceDistributionReleaseRecord[] {
    const store = ensureDataFile();
    let list = Object.values(store.releases);
    if (userId) {
      list = list.filter((r) => r.user_id === userId);
    }
    return list.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  },

  listDrafts(userId: string): OnceDistributionReleaseRecord[] {
    return this.listReleases(userId).filter((r) =>
      ["draft", "pending_submission", "failed", "rejected"].includes(r.status)
    );
  },

  deleteDraft(id: string, userId: string): boolean {
    const store = ensureDataFile();
    const existing = store.releases[id];
    if (!existing || existing.user_id !== userId) return false;
    if (!["draft", "pending_submission"].includes(existing.status)) return false;
    delete store.releases[id];
    persistData(store);
    const supabase = getSupabaseAdmin();
    if (supabase && UUID_REGEX.test(id)) {
      void supabase.from("once_distribution_releases").delete().eq("id", id).eq("user_id", userId);
    }
    return true;
  },

  // --- Audit Logs ---
  logAudit(entry: Omit<OnceAuditLogRecord, "id" | "created_at">): OnceAuditLogRecord {
    const store = ensureDataFile();
    const record: OnceAuditLogRecord = {
      id: crypto.randomUUID(),
      actor_user_id: entry.actor_user_id || null,
      actor_email: entry.actor_email || null,
      actor_role: entry.actor_role || "artist",
      action: entry.action,
      release_id: entry.release_id || null,
      once_release_id: entry.once_release_id || null,
      status: entry.status || "info",
      summary: entry.summary,
      details: entry.details || {},
      error_message: entry.error_message || null,
      created_at: new Date().toISOString(),
    };

    store.auditLogs.unshift(record);
    if (store.auditLogs.length > 1000) {
      store.auditLogs = store.auditLogs.slice(0, 1000);
    }
    persistData(store);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      void supabase.from("once_audit_logs").insert({
        id: record.id,
        actor_user_id: record.actor_user_id && UUID_REGEX.test(record.actor_user_id) ? record.actor_user_id : null,
        actor_email: record.actor_email,
        actor_role: record.actor_role,
        action: record.action,
        release_id: record.release_id && UUID_REGEX.test(record.release_id) ? record.release_id : null,
        once_release_id: record.once_release_id,
        status: record.status,
        summary: record.summary,
        details: record.details,
        error_message: record.error_message,
        created_at: record.created_at,
      });
    }

    return record;
  },

  listAuditLogs(filters?: {
    limit?: number;
    action?: string;
    status?: string;
    releaseId?: string;
    actorUserId?: string;
  }): OnceAuditLogRecord[] {
    const store = ensureDataFile();
    let logs = store.auditLogs || [];
    if (filters?.action && filters.action !== "all") {
      logs = logs.filter((l) => l.action === filters.action);
    }
    if (filters?.status && filters.status !== "all") {
      logs = logs.filter((l) => l.status === filters.status);
    }
    if (filters?.releaseId) {
      logs = logs.filter((l) => l.release_id === filters.releaseId || l.once_release_id === filters.releaseId);
    }
    if (filters?.actorUserId) {
      logs = logs.filter((l) => l.actor_user_id === filters.actorUserId);
    }
    return logs.slice(0, filters?.limit || 150);
  },

  // --- Webhooks ---
  hasProcessedWebhookEvent(dedupeKey: string): boolean {
    if (!dedupeKey) return false;
    const store = ensureDataFile();
    return store.webhooks.some((w) => w.dedupeKey === dedupeKey && w.processed);
  },

  logWebhookEvent(event: {
    eventType: string;
    onceReleaseId?: string;
    dedupeKey?: string;
    occurredAt?: string;
    processedAt?: string;
    signatureVerified?: boolean;
    payload: Record<string, unknown>;
    processed?: boolean;
    errorMessage?: string;
  }) {
    const store = ensureDataFile();
    const now = new Date().toISOString();
    const item = {
      id: crypto.randomUUID(),
      eventType: event.eventType,
      onceReleaseId: event.onceReleaseId,
      dedupeKey: event.dedupeKey,
      occurredAt: event.occurredAt,
      processedAt: event.processedAt || (event.processed ? now : undefined),
      signatureVerified: event.signatureVerified ?? false,
      payload: event.payload,
      processed: event.processed ?? true,
      errorMessage: event.errorMessage,
      createdAt: now,
    };
    store.webhooks.unshift(item);
    if (store.webhooks.length > 500) {
      store.webhooks = store.webhooks.slice(0, 500);
    }
    persistData(store);
    return item;
  },

  listWebhookEvents(limit = 50) {
    const store = ensureDataFile();
    return store.webhooks.slice(0, limit);
  },

  // --- Settings ---
  getSettings(): OnceEngineSettingsRecord {
    const store = ensureDataFile();
    return store.settings;
  },

  updateSettings(updates: Partial<OnceEngineSettingsRecord>): OnceEngineSettingsRecord {
    const store = ensureDataFile();
    store.settings = {
      ...store.settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    persistData(store);
    return store.settings;
  },

  // --- Exchange Rate Cache & Financial Ledger ---
  getExchangeRateCache(): ExchangeRateSnapshot | null {
    const store = ensureDataFile();
    return store.exchangeRateCache || null;
  },

  setExchangeRateCache(snapshot: ExchangeRateSnapshot): ExchangeRateSnapshot {
    const store = ensureDataFile();
    store.exchangeRateCache = snapshot;
    store.settings = {
      ...store.settings,
      cached_zmw_to_usd_rate: snapshot.zmwToUsdRate,
      cached_usd_to_zmw_rate: snapshot.usdToZmwRate,
      exchange_rate_date: snapshot.rateDate,
      exchange_rate_source: snapshot.source,
      exchange_rate_updated_at: snapshot.fetchedAt,
      updated_at: new Date().toISOString(),
    };
    persistData(store);
    return snapshot;
  },

  listFinancialTransactions(limit = 500): ZedbuteFinancialTransactionRecord[] {
    const store = ensureDataFile();
    return [...(store.financialTransactions || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  upsertFinancialTransaction(
    tx: Omit<ZedbuteFinancialTransactionRecord, "id" | "created_at" | "updated_at"> & {
      id?: string;
      created_at?: string;
    }
  ): ZedbuteFinancialTransactionRecord {
    const store = ensureDataFile();
    const list = store.financialTransactions || [];
    const releaseTypes = new Set(["release", "single", "ep", "album"]);
    const existingIdx = list.findIndex(
      (item) =>
        item.transaction_id === tx.transaction_id ||
        (tx.release_id &&
          item.release_id === tx.release_id &&
          (item.payment_type === tx.payment_type ||
            (releaseTypes.has(item.payment_type) && releaseTypes.has(tx.payment_type))))
    );
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      const existing = list[existingIdx];
      // Preserve historical locked exchange rate if already recorded on this transaction
      const preservedRate = existing.zmw_to_usd_rate !== null ? existing : null;
      const updated: ZedbuteFinancialTransactionRecord = {
        ...existing,
        ...tx,
        id: existing.id,
        transaction_id: existing.transaction_id,
        payment_status:
          existing.payment_status === "verified" ? "verified" : tx.payment_status,
        zmw_to_usd_rate: preservedRate ? preservedRate.zmw_to_usd_rate : tx.zmw_to_usd_rate,
        usd_to_zmw_rate: preservedRate ? preservedRate.usd_to_zmw_rate : tx.usd_to_zmw_rate,
        exchange_rate_date: preservedRate ? preservedRate.exchange_rate_date : tx.exchange_rate_date,
        exchange_rate_fetched_at: preservedRate ? preservedRate.exchange_rate_fetched_at : tx.exchange_rate_fetched_at,
        exchange_rate_source: preservedRate ? preservedRate.exchange_rate_source : tx.exchange_rate_source,
        exchange_rate_is_stale: preservedRate ? preservedRate.exchange_rate_is_stale : tx.exchange_rate_is_stale,
        amount_usd: preservedRate ? preservedRate.amount_usd : tx.amount_usd,
        processing_fee_usd: preservedRate ? preservedRate.processing_fee_usd : tx.processing_fee_usd,
        once_expense_usd: Math.max(existing.once_expense_usd || 0, tx.once_expense_usd || 0),
        once_release_id: tx.once_release_id || existing.once_release_id,
        title: tx.title || existing.title,
        created_at: existing.created_at,
        updated_at: now,
      };
      if (updated.zmw_to_usd_rate && updated.zmw_to_usd_rate > 0) {
        const rate = updated.zmw_to_usd_rate;
        const onceUsd = updated.once_expense_usd || 0;
        const onceZmw = Math.round((onceUsd / rate) * 100) / 100;
        updated.once_expense_zmw = onceZmw;
        updated.net_profit_zmw = Math.round((updated.amount_zmw - updated.processing_fee_zmw - onceZmw) * 100) / 100;
        updated.net_profit_usd =
          updated.amount_usd !== null && updated.processing_fee_usd !== null
            ? Math.round((updated.amount_usd - updated.processing_fee_usd - onceUsd) * 100) / 100
            : null;
      }
      list[existingIdx] = updated;
      store.financialTransactions = list;
      persistData(store);
      return updated;
    }

    const created: ZedbuteFinancialTransactionRecord = {
      ...tx,
      id: tx.id || crypto.randomUUID(),
      created_at: tx.created_at || now,
      updated_at: now,
    };
    list.unshift(created);
    if (list.length > 2000) {
      store.financialTransactions = list.slice(0, 2000);
    } else {
      store.financialTransactions = list;
    }
    persistData(store);
    return created;
  },

  // --- Metrics ---
  getMetrics() {
    const store = ensureDataFile();
    const releases = Object.values(store.releases);

    let totalSubmitted = 0;
    let processing = 0;
    let approved = 0;
    let live = 0;
    let failed = 0;
    let drafts = 0;
    let totalCreditsSpent = 0;
    let humanSongs = 0;
    let aiSongs = 0;

    for (const r of releases) {
      if (r.status === "draft") drafts++;
      else totalSubmitted++;
      if (["pending_submission", "processing", "under_review", "queued"].includes(r.status)) processing++;
      if (["approved", "delivered"].includes(r.status)) approved++;
      if (["distributed", "live"].includes(r.status)) live++;
      if (["failed", "rejected"].includes(r.status)) failed++;

      totalCreditsSpent += r.credits_debited || 0;
      if (r.is_ai_detected) aiSongs++;
      else humanSongs++;
    }

    return {
      totalReleases: releases.length,
      drafts,
      totalSubmitted,
      processing,
      approved,
      live,
      failed,
      totalCreditsSpent,
      humanSongs,
      aiSongs,
      recentActivity: releases.slice(0, 10),
    };
  },
};
