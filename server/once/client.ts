import type {
  DistributionStoresResponse,
  AIDetectionResponse,
  ACRCheckResponse,
  ReleaseQuoteResponse,
  ReleaseStatusResponse,
  SubmitReleaseRequest,
  DraftRequest,
  OnceTrackInput,
} from "./types";

export interface OnceApiErrorDetails {
  status: number;
  type?: string;
  code?: string;
  message: string;
  retryAfterSeconds?: number;
  details?: unknown;
}

export class OnceApiError extends Error {
  status: number;
  type?: string;
  code?: string;
  retryAfterSeconds?: number;
  details?: unknown;

  constructor(err: OnceApiErrorDetails) {
    super(err.message || `ONCE API Error ${err.status}`);
    this.name = "OnceApiError";
    this.status = err.status;
    this.type = err.type;
    this.code = err.code;
    this.retryAfterSeconds = err.retryAfterSeconds;
    this.details = err.details;
  }
}

export class OnceClient {
  private baseUrl: string;
  private defaultToken: string;
  private provenanceTag: string;
  private clientId: string;

  constructor(options?: {
    baseUrl?: string;
    token?: string;
    provenanceTag?: string;
    clientId?: string;
  }) {
    this.baseUrl = (options?.baseUrl || process.env.ONCE_API_BASE_URL || "https://once.app/v1").replace(/\/+$/, "");
    this.defaultToken = options?.token || process.env.ONCE_ACCESS_TOKEN || "";
    this.provenanceTag = options?.provenanceTag || process.env.ONCE_PROVENANCE_TAG || "ZEDBUTE";
    this.clientId = options?.clientId || process.env.ONCE_CLIENT_ID || "";
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      token?: string;
      headers?: Record<string, string>;
      retryCount?: number;
      isSubmission?: boolean;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const token = options.token || this.defaultToken;
    const method = (options.method || "GET").toUpperCase();

    const headers: Record<string, string> = {
      "X-Once-Provenance": this.provenanceTag,
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let bodyData: BodyInit | undefined = undefined;
    if (options.body !== undefined) {
      if (typeof options.body === "string") {
        bodyData = options.body;
      } else if (Buffer.isBuffer(options.body)) {
        bodyData = new Uint8Array(options.body);
      } else {
        headers["Content-Type"] = "application/json";
        bodyData = JSON.stringify(options.body);
      }
    }

    const maxRetries = options.isSubmission ? 0 : 2; // Never blindly retry submissions
    let attempt = 0;

    while (true) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: bodyData,
        });

        if (response.ok) {
          if (response.status === 204) {
            return {} as T;
          }
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            return (await response.json()) as T;
          }
          return (await response.text()) as unknown as T;
        }

        // Parse error response
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: await response.text() };
        }

        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : errorData.retryAfterSeconds;

        const apiError = new OnceApiError({
          status: response.status,
          type: errorData.type || errorData.error,
          code: errorData.code,
          message: errorData.message || errorData.error_description || `Request failed with status ${response.status}`,
          retryAfterSeconds,
          details: errorData.details,
        });

        // Retry on 502 Upstream Error if safe
        if (response.status === 502 && attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 600;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw apiError;
      } catch (err: unknown) {
        if (err instanceof OnceApiError) {
          throw err;
        }
        if (attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 600;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new OnceApiError({
          status: 500,
          message: err instanceof Error ? err.message : "Network error contacting ONCE API",
        });
      }
    }
  }

  // --- Discovery Endpoints ---

  async getMetadataRules(): Promise<{ markdown: string }> {
    return this.request<{ markdown: string }>("/metadata-rules");
  }

  async getDistributionStores(): Promise<DistributionStoresResponse> {
    return this.request<DistributionStoresResponse>("/distribution-stores");
  }

  async getLanguageScriptCodes(token?: string): Promise<Array<{ code: string; language: string; script: string }>> {
    return this.request<Array<{ code: string; language: string; script: string }>>("/language-script-codes", { token });
  }

  async getReleaseSchema(token?: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/release-schema", { token });
  }

  async getStatus(): Promise<{ status: string; name: string; version: string }> {
    return this.request<{ status: string; name: string; version: string }>("/status");
  }

  async getCredits(token?: string): Promise<{
    credits: number;
    currency?: string;
    transactions?: Array<Record<string, unknown>>;
  }> {
    return this.request("/me/credits", { token });
  }

  // --- Partner Authentication & Accounts ---

  async createPartnerAccount(params: {
    email: string;
    password?: string;
    name?: string;
    code_challenge: string;
    code_challenge_method?: "S256";
    client_id?: string;
  }): Promise<{ authorization_code?: string; code?: string; account_id?: string }> {
    return this.request("/accounts", {
      method: "POST",
      body: {
        client_id: params.client_id || this.clientId,
        email: params.email,
        password: params.password,
        name: params.name,
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method || "S256",
      },
    });
  }

  async authorizePartnerAccount(params: {
    email: string;
    password?: string;
    code_challenge: string;
    code_challenge_method?: "S256";
    client_id?: string;
  }): Promise<{ authorization_code?: string; code?: string }> {
    return this.request("/auth/authorize", {
      method: "POST",
      body: {
        client_id: params.client_id || this.clientId,
        email: params.email,
        password: params.password,
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method || "S256",
      },
    });
  }

  async exchangeToken(params: {
    code: string;
    code_verifier: string;
    redirect_uri?: string;
    client_id?: string;
    grant_type?: "authorization_code" | "refresh_token";
    refresh_token?: string;
  }): Promise<{
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  }> {
    return this.request("/auth/token", {
      method: "POST",
      body: {
        grant_type: params.grant_type || "authorization_code",
        code: params.code,
        code_verifier: params.code_verifier,
        redirect_uri: params.redirect_uri || "https://music.zedbute.com/oauth/callback",
        client_id: params.client_id || this.clientId,
        refresh_token: params.refresh_token,
      },
    });
  }

  // --- Uploads ---

  async uploadFileBase64(params: {
    type: "audio" | "coverArt" | "rightsDocument";
    file_name: string;
    data_base64: string;
    mime_type?: string;
  }, token?: string): Promise<{ fileUrl: string; fileName: string; type: string }> {
    return this.request("/files", {
      method: "POST",
      body: params,
      token,
    });
  }

  async importFileFromUrl(params: {
    type: "audio" | "coverArt" | "rightsDocument";
    url: string;
    file_name: string;
  }, token?: string): Promise<{ fileUrl: string; fileName: string; type: string }> {
    return this.request("/files/from-url", {
      method: "POST",
      body: params,
      token,
    });
  }

  async createChunkedUploadSession(params: {
    type: "audio" | "coverArt";
    file_name: string;
    file_size: number;
    file_type: string;
  }, token?: string): Promise<{
    session_id: string;
    upload_token: string;
    upload_header_name: string;
    chunk_endpoint: string;
    complete_endpoint: string;
    chunk_size?: number;
    recommended_chunk_bytes?: number;
    max_chunk_bytes?: number;
    total_chunks?: number;
  }> {
    return this.request("/uploads", {
      method: "POST",
      body: params,
      token,
    });
  }

  async uploadChunkRaw(params: {
    chunkEndpoint: string;
    uploadHeaderName: string;
    uploadToken: string;
    sessionId: string;
    chunkIndex: number;
    type: "audio" | "coverArt";
    chunkBuffer: Buffer;
  }): Promise<Record<string, unknown>> {
    const response = await fetch(params.chunkEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Once-Provenance": this.provenanceTag,
        [params.uploadHeaderName]: params.uploadToken,
        "x-session-id": params.sessionId,
        "x-chunk-index": String(params.chunkIndex),
        "x-upload-type": params.type,
      },
      body: new Uint8Array(params.chunkBuffer),
    });

    if (!response.ok) {
      let errMsg = `Chunk upload failed with status ${response.status}`;
      let errData: any = {};
      try {
        errData = await response.json();
        errMsg = errData.message || errData.error || errMsg;
      } catch {
        // ignore parse error
      }
      throw new OnceApiError({
        status: response.status,
        type: errData.type || "upload_error",
        code: errData.code || "chunk_upload_failed",
        message: errMsg,
      });
    }

    return (await response.json().catch(() => ({ ok: true }))) as Record<string, unknown>;
  }

  async completeChunkedUpload(params: {
    completeEndpoint: string;
    uploadHeaderName: string;
    uploadToken: string;
    sessionId: string;
    fileName: string;
    fileType: string;
    type: "audio" | "coverArt";
  }): Promise<{ fileUrl: string; fileName: string; type: string }> {
    const response = await fetch(params.completeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Once-Provenance": this.provenanceTag,
        [params.uploadHeaderName]: params.uploadToken,
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        fileName: params.fileName,
        fileType: params.fileType,
        type: params.type,
      }),
    });

    if (!response.ok) {
      let errMsg = `Failed to complete chunked upload (${response.status})`;
      let errData: any = {};
      try {
        errData = await response.json();
        errMsg = errData.message || errData.error || errMsg;
      } catch {
        // ignore parse error
      }
      throw new OnceApiError({
        status: response.status,
        type: errData.type || "upload_error",
        code: errData.code || "chunk_complete_failed",
        message: errMsg,
      });
    }

    return (await response.json()) as { fileUrl: string; fileName: string; type: string };
  }

  // --- Audio Intelligence ---

  async runAIDetection(params: {
    file_url: string;
    file_name?: string;
    release_id?: string;
    track_index?: number;
  }, token?: string): Promise<AIDetectionResponse> {
    return this.request("/audio/ai-detection", {
      method: "POST",
      body: params,
      token,
    });
  }

  async runACRCheck(params: {
    file_url: string;
    file_name?: string;
  }, token?: string): Promise<ACRCheckResponse> {
    return this.request("/audio/acr-check", {
      method: "POST",
      body: params,
      token,
    });
  }

  // --- Drafts & Quotes ---

  async saveDraft(params: DraftRequest, token?: string): Promise<{
    releaseId: string;
    releaseCreated?: boolean;
    snapshot?: Record<string, unknown>;
    latest?: Record<string, unknown>;
  }> {
    return this.request("/drafts", {
      method: "POST",
      body: params,
      token,
    });
  }

  async getReleaseQuote(tracks: OnceTrackInput[], token?: string): Promise<ReleaseQuoteResponse> {
    return this.request("/releases/quote", {
      method: "POST",
      body: { tracks, token_offset: false },
      token,
    });
  }

  // --- Releases Submission & Tracking ---

  async submitRelease(params: SubmitReleaseRequest, token?: string): Promise<{
    releaseId: string;
    status: string;
    upc?: string;
    jobId?: string;
  }> {
    return this.request("/releases", {
      method: "POST",
      body: params,
      token,
      isSubmission: true, // Prevents automatic replay on network hiccups
    });
  }

  async listReleases(token?: string): Promise<Array<Record<string, unknown>>> {
    return this.request("/releases", { token });
  }

  async getRelease(id: string, token?: string): Promise<Record<string, unknown>> {
    return this.request(`/releases/${encodeURIComponent(id)}`, { token });
  }

  async getReleaseStatus(id: string, token?: string): Promise<ReleaseStatusResponse> {
    return this.request(`/releases/${encodeURIComponent(id)}/status`, { token });
  }

  async getReleaseJob(id: string, token?: string): Promise<Record<string, unknown>> {
    return this.request(`/releases/${encodeURIComponent(id)}/job`, { token });
  }

  // --- Webhooks ---

  async registerWebhook(params: {
    url: string;
    description?: string;
    event_types?: string[];
  }, token?: string): Promise<{ id: string; url: string; signing_secret: string }> {
    return this.request("/webhooks", {
      method: "POST",
      body: params,
      token,
    });
  }

  async listWebhooks(token?: string): Promise<Array<{ id: string; url: string; active: boolean; event_types: string[] }>> {
    return this.request("/webhooks", { token });
  }
}

export const onceClient = new OnceClient();
