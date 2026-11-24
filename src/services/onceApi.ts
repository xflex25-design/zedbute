import { supabase } from "@/integrations/supabase/client";
import { CLIENT_AUDIO_SPECS } from "@/lib/onceCatalog";
import type {
  DistributionStoresResponse,
  AIDetectionResponse,
  ACRCheckResponse,
  ReleaseQuoteResponse,
  ReleaseStatusResponse,
  OnceDistributionReleaseRecord,
  OnceEngineSettingsRecord,
  OnceAuditLogRecord,
  SubmitReleaseRequest,
  DraftRequest,
  OnceTrackInput,
  OnceReleaseInput,
  ValidationReport,
  AudioFileInspection,
  CoverArtInspection,
  AnalyticsDatePreset,
  ZedbuteArtistAnalyticsPayload,
  ZedbuteReleaseAnalyticsPayload,
  ZedbuteAdminAnalyticsPayload,
} from "../../server/once/types";

const API_BASE = "/api/once";

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Please sign in to continue.");
  }
  return accessToken;
}

async function fetchAuthJson<T>(url: string, options?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();

  return fetchJson<T>(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorData: any = {};
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: await res.text() };
    }
    const err = new Error(errorData.message || errorData.error || `Request failed with status ${res.status}`);
    (err as any).status = res.status;
    (err as any).code = errorData.code;
    (err as any).type = errorData.type;
    (err as any).details = errorData.details;
    (err as any).missingFields = errorData.missingFields;
    throw err;
  }

  return res.json() as Promise<T>;
}

export interface UploadedAssetResult {
  fileUrl: string;
  fileName: string;
  type: "audio" | "coverArt" | "rightsDocument";
  target: "once" | "zedbute_storage";
  verified: boolean;
}

export const onceApi = {
  // Discovery & Status
  async getStatus() {
    return fetchJson<{
      configured: boolean;
      hasLiveToken?: boolean;
      webhookSecretConfigured: boolean;
      partnerClientId: string | null;
      provenanceTag: string;
      apiStatus: any;
      credits: { credits: number; currency?: string } | null;
      settings: OnceEngineSettingsRecord;
      metrics: any;
    }>(`${API_BASE}/status`);
  },

  async getMetadataRules(): Promise<{
    markdown: string;
    source?: "live" | "cached_spec";
    audioRequirements?: Record<string, unknown>;
    coverArtRequirements?: Record<string, unknown>;
  }> {
    return fetchJson(`${API_BASE}/metadata-rules`);
  },

  async getDistributionStores(): Promise<DistributionStoresResponse> {
    return fetchJson<DistributionStoresResponse>(`${API_BASE}/distribution-stores`);
  },

  async getLanguageScriptCodes(): Promise<Array<{ code: string; language: string; script: string }>> {
    return fetchJson<Array<{ code: string; language: string; script: string }>>(`${API_BASE}/language-script-codes`);
  },

  async getReleaseSchema(): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/release-schema`);
  },

  // Validation
  async validateRelease(params: {
    release: Partial<OnceReleaseInput>;
    tracks: Array<Partial<OnceTrackInput>>;
    distributionMode?: "once_api" | "manual_k70";
  }): Promise<ValidationReport> {
    return fetchJson<ValidationReport>(`${API_BASE}/releases/validate`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // Audio Intelligence
  async runAIDetection(params: {
    file_url: string;
    file_name?: string;
    release_id?: string;
  }): Promise<AIDetectionResponse & { creditCost: number; status: string }> {
    return fetchAuthJson(`${API_BASE}/audio/ai-detection`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async runACRCheck(params: {
    file_url: string;
    file_name?: string;
  }): Promise<ACRCheckResponse> {
    return fetchAuthJson(`${API_BASE}/audio/acr-check`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // Uploads (Direct, Chunked Proxy to ONCE, or Zedbute Supabase Storage staging)
  async uploadFromUrl(params: {
    url: string;
    file_name: string;
    type: "audio" | "coverArt" | "rightsDocument";
  }) {
    return fetchAuthJson<{ fileUrl: string; fileName: string; type: string }>(`${API_BASE}/upload/from-url`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async uploadFileDirect(file: File, type: "audio" | "coverArt" | "rightsDocument" = "coverArt") {
    const token = await getAccessToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const res = await fetch(`${API_BASE}/upload/file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      const err = new Error(errData.message || errData.error || "Upload failed");
      (err as any).status = res.status;
      (err as any).code = errData.code;
      throw err;
    }
    return res.json() as Promise<{ fileUrl: string; fileName: string; type: string }>;
  },

  async uploadAssetWithProgress(params: {
    file: File;
    type: "audio" | "coverArt";
    userId: string;
    audioMetadata?: AudioFileInspection;
    coverArtMetadata?: CoverArtInspection;
    onProgress?: (percent: number, phase: string) => void;
  }): Promise<UploadedAssetResult> {
    const { file, type, userId, audioMetadata, coverArtMetadata, onProgress } = params;
    const token = await getAccessToken();
    onProgress?.(5, "Starting verified upload...");

    // Try ONCE direct/chunked pipeline first
    try {
      if (file.size <= CLIENT_AUDIO_SPECS.chunkThresholdBytes) {
        onProgress?.(35, "Uploading file to ONCE...");
        const direct = await this.uploadFileDirect(file, type);
        onProgress?.(100, "Verified by ONCE");
        return {
          fileUrl: direct.fileUrl,
          fileName: direct.fileName || file.name,
          type,
          target: "once",
          verified: Boolean(direct.fileUrl),
        };
      }

      // Large file: create authenticated ONCE chunked upload session
      const session = await fetchAuthJson<{
        session_id: string;
        recommended_chunk_bytes: number;
        max_chunk_bytes: number;
        total_chunks?: number;
      }>(`${API_BASE}/upload/session`, {
        method: "POST",
        body: JSON.stringify({
          type,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || (type === "audio" ? "audio/wav" : "image/jpeg"),
          audio_metadata: audioMetadata,
          cover_art_metadata: coverArtMetadata,
        }),
      });

      const chunkSize = Math.min(
        session.recommended_chunk_bytes || CLIENT_AUDIO_SPECS.chunkSizeBytes,
        session.max_chunk_bytes || 6 * 1024 * 1024
      );
      const totalChunks = Math.ceil(file.size / chunkSize);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const slice = file.slice(start, end);

        const fd = new FormData();
        fd.append("chunk", slice, `${file.name}.part${chunkIndex}`);
        fd.append("sessionId", session.session_id);
        fd.append("chunkIndex", String(chunkIndex));
        fd.append("type", type);

        const chunkRes = await fetch(`${API_BASE}/upload/chunk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!chunkRes.ok) {
          const errData = await chunkRes.json().catch(() => ({ message: "Chunk upload failed" }));
          throw new Error(errData.message || errData.error || `Chunk ${chunkIndex + 1} failed`);
        }

        const pct = Math.min(92, Math.round(((chunkIndex + 1) / totalChunks) * 85) + 8);
        onProgress?.(pct, `Uploading chunk ${chunkIndex + 1} of ${totalChunks}...`);
      }

      onProgress?.(95, "Verifying uploaded file with ONCE...");
      const completed = await fetchAuthJson<{
        fileUrl: string;
        fileName: string;
        type: string;
        verified: boolean;
      }>(`${API_BASE}/upload/complete`, {
        method: "POST",
        body: JSON.stringify({ sessionId: session.session_id }),
      });

      onProgress?.(100, "Upload verified");
      return {
        fileUrl: completed.fileUrl,
        fileName: completed.fileName || file.name,
        type,
        target: "once",
        verified: Boolean(completed.fileUrl),
      };
    } catch (err: any) {
      // Only fall back to Zedbute Supabase storage if server reports ONCE token is not yet configured (412)
      if (err?.code !== "once_token_missing" && err?.status !== 412) {
        throw err;
      }
    }

    // Fallback to Zedbute Supabase Storage (for manual K70 releases or staging drafts before ONCE token connection)
    const bucket = type === "coverArt" ? "cover-art" : "audio-files";
    const safeExt = (file.name.split(".").pop() || (type === "coverArt" ? "jpg" : "wav")).toLowerCase();
    const storagePath = `${userId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

    let simulatedPct = 15;
    onProgress?.(simulatedPct, `Uploading ${type === "coverArt" ? "artwork" : "audio"} to Zedbute storage...`);
    const timer = window.setInterval(() => {
      simulatedPct = Math.min(88, simulatedPct + 9);
      onProgress?.(simulatedPct, `Uploading ${type === "coverArt" ? "artwork" : "audio"} to Zedbute storage...`);
    }, 350);

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      if (!publicUrl) throw new Error("Upload completed without a retrievable storage URL.");

      onProgress?.(100, "Upload verified & saved");
      return {
        fileUrl: publicUrl,
        fileName: file.name,
        type,
        target: "zedbute_storage",
        verified: true,
      };
    } finally {
      window.clearInterval(timer);
    }
  },

  // Drafts & Quotes
  async saveDraft(params: DraftRequest): Promise<{
    success: boolean;
    draft: OnceDistributionReleaseRecord;
    onceDraftId: string | null;
    onceSyncStatus: "synced" | "sync_warning" | "local_only";
    onceSyncError?: string | null;
    onceWarnings?: Array<Record<string, unknown>>;
  }> {
    return fetchAuthJson(`${API_BASE}/drafts`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async listDrafts(): Promise<OnceDistributionReleaseRecord[]> {
    return fetchAuthJson<OnceDistributionReleaseRecord[]>(`${API_BASE}/drafts`);
  },

  async getDraft(id: string): Promise<OnceDistributionReleaseRecord> {
    return fetchAuthJson<OnceDistributionReleaseRecord>(`${API_BASE}/drafts/${encodeURIComponent(id)}`);
  },

  async deleteDraft(id: string): Promise<{ success: boolean }> {
    return fetchAuthJson<{ success: boolean }>(`${API_BASE}/drafts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async getReleaseQuote(
    tracks: OnceTrackInput[],
    localReleaseId?: string
  ): Promise<ReleaseQuoteResponse & { accountCredits?: number | null }> {
    return fetchAuthJson(`${API_BASE}/releases/quote`, {
      method: "POST",
      body: JSON.stringify({ tracks, local_release_id: localReleaseId }),
    });
  },

  // Submissions & Releases
  async submitRelease(params: SubmitReleaseRequest & {
    local_release_id?: string;
    once_draft_id?: string;
    confirmed: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    releaseRecord: OnceDistributionReleaseRecord;
    onceReleaseId: string;
    status: string;
    upc?: string;
  }> {
    return fetchAuthJson(`${API_BASE}/releases`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async listReleases(userId?: string): Promise<OnceDistributionReleaseRecord[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return fetchAuthJson<OnceDistributionReleaseRecord[]>(`${API_BASE}/releases${query}`);
    }
    return fetchJson<OnceDistributionReleaseRecord[]>(`${API_BASE}/releases${query}`);
  },

  async getRelease(id: string): Promise<OnceDistributionReleaseRecord> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return fetchAuthJson<OnceDistributionReleaseRecord>(`${API_BASE}/releases/${encodeURIComponent(id)}`);
    }
    return fetchJson<OnceDistributionReleaseRecord>(`${API_BASE}/releases/${encodeURIComponent(id)}`);
  },

  async getReleaseStatus(id: string): Promise<ReleaseStatusResponse> {
    return fetchJson<ReleaseStatusResponse>(`${API_BASE}/releases/${encodeURIComponent(id)}/status`);
  },

  async getReleaseJob(id: string): Promise<Record<string, unknown>> {
    return fetchJson<Record<string, unknown>>(`${API_BASE}/releases/${encodeURIComponent(id)}/job`);
  },

  // Admin Controls & Audit Logs
  async getAdminMetrics() {
    return fetchAuthJson<{
      metrics: any;
      onceCredits: any;
      settings: OnceEngineSettingsRecord;
      recentWebhooks: any[];
      webhookSecretConfigured: boolean;
    }>(`${API_BASE}/admin/metrics`);
  },

  async getAdminReleases(): Promise<OnceDistributionReleaseRecord[]> {
    return fetchAuthJson<OnceDistributionReleaseRecord[]>(`${API_BASE}/admin/releases`);
  },

  async getAdminAuditLogs(filters?: {
    action?: string;
    status?: string;
    releaseId?: string;
    limit?: number;
  }): Promise<OnceAuditLogRecord[]> {
    const search = new URLSearchParams();
    if (filters?.action && filters.action !== "all") search.set("action", filters.action);
    if (filters?.status && filters.status !== "all") search.set("status", filters.status);
    if (filters?.releaseId) search.set("releaseId", filters.releaseId);
    if (filters?.limit) search.set("limit", String(filters.limit));
    const qs = search.toString();
    return fetchAuthJson<OnceAuditLogRecord[]>(`${API_BASE}/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },

  async reviewAdminRelease(
    id: string,
    payload: { action: "approve_and_submit" | "approve_manual" | "reject" | "sync_status"; notes?: string }
  ): Promise<{ success: boolean; message: string; release: OnceDistributionReleaseRecord }> {
    return fetchAuthJson(`${API_BASE}/admin/review/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getAdminSettings(): Promise<OnceEngineSettingsRecord> {
    return fetchJson<OnceEngineSettingsRecord>(`${API_BASE}/admin/settings`);
  },

  async updateAdminSettings(settings: Partial<OnceEngineSettingsRecord>): Promise<OnceEngineSettingsRecord> {
    return fetchAuthJson<OnceEngineSettingsRecord>(`${API_BASE}/admin/settings`, {
      method: "POST",
      body: JSON.stringify(settings),
    });
  },

  async retryRelease(id: string): Promise<{ success: boolean; message: string; release: OnceDistributionReleaseRecord }> {
    return fetchAuthJson(`${API_BASE}/admin/retry/${encodeURIComponent(id)}`, {
      method: "POST",
    });
  },

  // Webhooks
  async registerWebhook(params: { url: string; description?: string }) {
    return fetchAuthJson(`${API_BASE}/webhooks/register`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async getWebhooks() {
    return fetchAuthJson<{ endpoints: any[]; recentEvents: any[] }>(`${API_BASE}/webhooks`);
  },

  // Performance Analytics (Authenticated via Supabase JWT)
  async getAnalyticsSummary(params: {
    range?: AnalyticsDatePreset;
    fromDate?: string;
    toDate?: string;
  } = {}): Promise<ZedbuteArtistAnalyticsPayload> {
    const search = new URLSearchParams();
    if (params.range) search.set("range", params.range);
    if (params.fromDate) search.set("fromDate", params.fromDate);
    if (params.toDate) search.set("toDate", params.toDate);
    const qs = search.toString();
    return fetchAuthJson<ZedbuteArtistAnalyticsPayload>(
      `${API_BASE}/analytics/summary${qs ? `?${qs}` : ""}`
    );
  },

  async getReleaseAnalytics(
    releaseId: string,
    params: {
      range?: AnalyticsDatePreset;
      fromDate?: string;
      toDate?: string;
      distributorId?: number | null;
    } = {}
  ): Promise<ZedbuteReleaseAnalyticsPayload> {
    const search = new URLSearchParams();
    if (params.range) search.set("range", params.range);
    if (params.fromDate) search.set("fromDate", params.fromDate);
    if (params.toDate) search.set("toDate", params.toDate);
    if (params.distributorId !== undefined && params.distributorId !== null) {
      search.set("distributorId", String(params.distributorId));
    }
    const qs = search.toString();
    return fetchAuthJson<ZedbuteReleaseAnalyticsPayload>(
      `${API_BASE}/analytics/releases/${encodeURIComponent(releaseId)}${qs ? `?${qs}` : ""}`
    );
  },

  async getAdminAnalyticsSummary(params: {
    range?: AnalyticsDatePreset;
    fromDate?: string;
    toDate?: string;
  } = {}): Promise<ZedbuteAdminAnalyticsPayload> {
    const search = new URLSearchParams();
    if (params.range) search.set("range", params.range);
    if (params.fromDate) search.set("fromDate", params.fromDate);
    if (params.toDate) search.set("toDate", params.toDate);
    const qs = search.toString();
    return fetchAuthJson<ZedbuteAdminAnalyticsPayload>(
      `${API_BASE}/analytics/admin/summary${qs ? `?${qs}` : ""}`
    );
  },
};
