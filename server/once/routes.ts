import { Router, Request, Response } from "express";
import crypto from "crypto";
import multer from "multer";
import { onceClient } from "./client";
import { onceStore } from "./store";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  encryptToken,
} from "./crypto";
import { onceWebhookHandler } from "./webhook";
import {
  getAllManagedReleases,
  getUserOwnedReleases,
  getVerifiedOwnedRelease,
  requireAdminUser,
  requireAuthenticatedUser,
  resolveOnceTokenForUser,
} from "./auth";
import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  buildAdminAnalyticsOverview,
  buildArtistAnalyticsOverview,
  buildReleaseAnalytics,
  validateAnalyticsDateRange,
} from "./analytics";
import { OnceMcpError } from "./mcpClient";
import {
  getOnceMetadataRulesWithCache,
  getOnceReleaseSchemaWithCache,
  ONCE_AUDIO_REQUIREMENTS,
  ONCE_COVER_ART_REQUIREMENTS,
  ONCE_FALLBACK_STORES,
  validateAudioMetadata,
  validateCoverArtMetadata,
  validateReleaseSubmission,
} from "./validation";
import {
  SubmitReleaseRequest,
  DraftRequest,
  OnceTrackInput,
  OnceReleaseInput,
  OnceAuditLogRecord,
  AudioFileInspection,
  CoverArtInspection,
} from "./types";
import { calculateZedbuteFinancialSummary } from "./currency";

const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const chunkUpload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max per chunk (ONCE max 6 MB)
  storage: multer.memoryStorage(),
});

interface PendingUploadSession {
  sessionId: string;
  userId: string;
  uploadToken: string;
  uploadHeaderName: string;
  chunkEndpoint: string;
  completeEndpoint: string;
  fileName: string;
  fileType: string;
  type: "audio" | "coverArt";
  createdAt: number;
  fallbackMode?: boolean;
  chunks?: Map<number, Buffer>;
}

const activeUploadSessions = new Map<string, PendingUploadSession>();

function cleanupOldUploadSessions() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, v] of activeUploadSessions.entries()) {
    if (v.createdAt < cutoff) activeUploadSessions.delete(k);
  }
}

function isPublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith(".local")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveOptionalTokenFromReq(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7).trim();
    if (jwt.startsWith("once_")) return jwt;
  }
  return process.env.ONCE_ACCESS_TOKEN || undefined;
}

export const onceRouter = Router();

// -------------------------------------------------------------
// 1. Status & Discovery Endpoints
// -------------------------------------------------------------

onceRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const configured = Boolean(process.env.ONCE_ACCESS_TOKEN || process.env.ONCE_CLIENT_ID);
    let apiStatus: any = null;
    let credits: any = null;

    try {
      apiStatus = await onceClient.getStatus();
    } catch (e: any) {
      apiStatus = { error: e.message };
    }

    if (process.env.ONCE_ACCESS_TOKEN) {
      try {
        credits = await onceClient.getCredits();
      } catch (e: any) {
        credits = { error: e.message };
      }
    }

    const settings = onceStore.getSettings();
    const metrics = onceStore.getMetrics();

    res.json({
      configured,
      hasLiveToken: Boolean(process.env.ONCE_ACCESS_TOKEN),
      webhookSecretConfigured: Boolean(process.env.ONCE_WEBHOOK_SECRET),
      partnerClientId: process.env.ONCE_CLIENT_ID ? `${process.env.ONCE_CLIENT_ID.substring(0, 4)}...` : null,
      provenanceTag: process.env.ONCE_PROVENANCE_TAG || "ZEDBUTE",
      apiStatus,
      credits,
      settings,
      metrics,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

onceRouter.get("/metadata-rules", async (_req: Request, res: Response) => {
  try {
    const rules = await getOnceMetadataRulesWithCache();
    res.json({
      ...rules,
      audioRequirements: ONCE_AUDIO_REQUIREMENTS,
      coverArtRequirements: ONCE_COVER_ART_REQUIREMENTS,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

onceRouter.get("/distribution-stores", async (_req: Request, res: Response) => {
  try {
    const stores = await onceClient.getDistributionStores();
    res.json(stores);
  } catch {
    res.json(ONCE_FALLBACK_STORES);
  }
});

onceRouter.get("/language-script-codes", async (req: Request, res: Response) => {
  try {
    const token = await resolveOptionalTokenFromReq(req);
    const codes = await onceClient.getLanguageScriptCodes(token);
    res.json(codes);
  } catch {
    res.json([
      { code: "en-Latn", language: "en", script: "Latn" },
      { code: "fr-Latn", language: "fr", script: "Latn" },
      { code: "es-Latn", language: "es", script: "Latn" },
      { code: "pt-Latn", language: "pt", script: "Latn" },
      { code: "ja-Kana", language: "ja", script: "Kana" },
      { code: "ja-Latn", language: "ja", script: "Latn" },
      { code: "ko-Hang", language: "ko", script: "Hang" },
      { code: "zh-Hans", language: "zh", script: "Hans" },
    ]);
  }
});

onceRouter.get("/release-schema", async (req: Request, res: Response) => {
  try {
    const token = await resolveOptionalTokenFromReq(req);
    const { schema, source } = await getOnceReleaseSchemaWithCache(token);
    res.json({ ...schema, source });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. Partner Server-to-Server Authentication (PKCE)
// -------------------------------------------------------------

onceRouter.post("/auth/setup-account", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { email, name, password } = req.body;
    const targetEmail = email || authUser.email;
    if (!targetEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const response = await onceClient.createPartnerAccount({
      email: targetEmail,
      name,
      password,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authCode = response.authorization_code || response.code;
    if (!authCode) {
      return res.status(502).json({ error: "ONCE did not return an authorization code" });
    }

    const tokenResponse = await onceClient.exchangeToken({
      code: authCode,
      code_verifier: codeVerifier,
    });

    const encryptedAccess = encryptToken(tokenResponse.access_token);
    const encryptedRefresh = tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : undefined;
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined;

    onceStore.saveAccount(authUser.id, {
      onceAccountId: response.account_id,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
    });

    onceStore.logAudit({
      actor_user_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.isAdmin ? "admin" : "artist",
      action: "once_account_connected",
      status: "success",
      summary: `ONCE partner account provisioned for ${targetEmail}`,
      details: { onceAccountId: response.account_id },
    });

    res.json({
      success: true,
      message: "ONCE account created and authorized successfully",
      accountId: response.account_id,
      expiresAt,
    });
  } catch (err: any) {
    console.error("[ONCE Auth Setup] Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Failed to setup ONCE account",
      code: err.code,
      type: err.type,
    });
  }
});

onceRouter.post("/auth/authorize", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { email, password } = req.body;
    const targetEmail = email || authUser.email;
    if (!targetEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const authResult = await onceClient.authorizePartnerAccount({
      email: targetEmail,
      password,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authCode = authResult.authorization_code || authResult.code;
    if (!authCode) {
      return res.status(502).json({ error: "ONCE did not return an authorization code" });
    }

    const tokenResponse = await onceClient.exchangeToken({
      code: authCode,
      code_verifier: codeVerifier,
    });

    const encryptedAccess = encryptToken(tokenResponse.access_token);
    const encryptedRefresh = tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : undefined;
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined;

    onceStore.saveAccount(authUser.id, {
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
    });

    res.json({
      success: true,
      message: "ONCE authorization successful",
      expiresAt,
    });
  } catch (err: any) {
    console.error("[ONCE Authorize] Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Failed to authorize with ONCE",
      code: err.code,
      type: err.type,
    });
  }
});

// -------------------------------------------------------------
// 3. Uploads (Direct, URL Import & Chunked Upload Proxy)
// -------------------------------------------------------------

onceRouter.post("/upload/file", upload.single("file"), async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    if (!token) {
      return res.status(412).json({
        code: "once_token_missing",
        error: "ONCE API access token is not configured on the server for direct ONCE asset upload.",
      });
    }

    const type = (req.body.type || "coverArt") as "audio" | "coverArt" | "rightsDocument";

    if (req.file) {
      const result = await onceClient.uploadFileBase64(
        {
          type,
          file_name: req.file.originalname,
          data_base64: req.file.buffer.toString("base64"),
          mime_type: req.file.mimetype,
        },
        token
      );
      onceStore.logAudit({
        actor_user_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.isAdmin ? "admin" : "artist",
        action: "asset_uploaded",
        status: "success",
        summary: `Uploaded ${type} asset (${req.file.originalname}) to ONCE`,
        details: { type, fileName: req.file.originalname, fileUrl: result.fileUrl },
      });
      return res.json(result);
    }

    const { file_name, data_base64, mime_type } = req.body;
    if (!file_name || !data_base64) {
      return res.status(400).json({ error: "file_name and data_base64 are required" });
    }

    const result = await onceClient.uploadFileBase64(
      { type, file_name, data_base64, mime_type },
      token
    );
    res.json(result);
  } catch (err: any) {
    console.error("[ONCE File Upload] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/upload/from-url", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    if (!token) {
      return res.status(412).json({
        code: "once_token_missing",
        error: "ONCE API access token is not configured on the server.",
      });
    }

    const { url, file_name, type } = req.body;
    if (!url || !file_name) {
      return res.status(400).json({ error: "url and file_name are required" });
    }
    if (!isPublicHttpsUrl(url)) {
      return res.status(400).json({ error: "url must be a publicly accessible https:// URL" });
    }

    const result = await onceClient.importFileFromUrl(
      {
        type: (type || "audio") as "audio" | "coverArt" | "rightsDocument",
        url,
        file_name,
      },
      token
    );
    onceStore.logAudit({
      actor_user_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.isAdmin ? "admin" : "artist",
      action: "asset_imported_from_url",
      status: "success",
      summary: `Imported ${type || "audio"} asset (${file_name}) into ONCE`,
      details: { fileUrl: result.fileUrl },
    });
    res.json(result);
  } catch (err: any) {
    console.error("[ONCE URL Import] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/upload/session", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    cleanupOldUploadSessions();
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    if (!token) {
      return res.status(412).json({
        code: "once_token_missing",
        error: "ONCE API access token is not configured on the server for ONCE chunked uploads.",
      });
    }

    const { file_name, file_size, file_type, type, audio_metadata, cover_art_metadata } = req.body as {
      file_name?: string;
      file_size?: number;
      file_type?: string;
      type?: "audio" | "coverArt";
      audio_metadata?: AudioFileInspection;
      cover_art_metadata?: CoverArtInspection;
    };

    if (!file_name || !file_size) {
      return res.status(400).json({ error: "file_name and file_size are required" });
    }

    const assetType = type === "coverArt" ? "coverArt" : "audio";
    const sizeBytes = Number(file_size);

    if (assetType === "audio") {
      if (sizeBytes > ONCE_AUDIO_REQUIREMENTS.maxFileSizeBytes) {
        return res.status(422).json({
          code: "audio_file_too_large",
          error: "Audio file exceeds ONCE's 1 GB maximum limit.",
        });
      }
      const issues = validateAudioMetadata(audio_metadata, 0).filter((i) => i.severity === "error");
      if (issues.length > 0) {
        return res.status(422).json({
          code: issues[0].code,
          error: issues[0].message,
          details: issues,
        });
      }
    } else {
      if (sizeBytes > ONCE_COVER_ART_REQUIREMENTS.maxFileSizeBytes) {
        return res.status(422).json({
          code: "cover_file_too_large",
          error: "Cover art exceeds ONCE's 50 MB maximum limit.",
        });
      }
      const issues = validateCoverArtMetadata(cover_art_metadata).filter((i) => i.severity === "error");
      if (issues.length > 0) {
        return res.status(422).json({
          code: issues[0].code,
          error: issues[0].message,
          details: issues,
        });
      }
    }

    const session = await onceClient.createChunkedUploadSession(
      {
        file_name,
        file_size: sizeBytes,
        file_type: file_type || (assetType === "audio" ? "audio/wav" : "image/jpeg"),
        type: assetType,
      },
      token
    );

    activeUploadSessions.set(session.session_id, {
      sessionId: session.session_id,
      userId: authUser.id,
      uploadToken: session.upload_token,
      uploadHeaderName: session.upload_header_name || "x-mcp-upload-token",
      chunkEndpoint: session.chunk_endpoint,
      completeEndpoint: session.complete_endpoint,
      fileName: file_name,
      fileType: file_type || (assetType === "audio" ? "audio/wav" : "image/jpeg"),
      type: assetType,
      createdAt: Date.now(),
    });

    res.json({
      session_id: session.session_id,
      recommended_chunk_bytes:
        session.recommended_chunk_bytes || session.chunk_size || ONCE_AUDIO_REQUIREMENTS.recommendedChunkBytes,
      max_chunk_bytes: session.max_chunk_bytes || 6 * 1024 * 1024,
      total_chunks: session.total_chunks,
    });
  } catch (err: any) {
    console.error("[ONCE Chunked Session] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/upload/chunk", chunkUpload.single("chunk"), async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const sessionId = String(req.body?.sessionId || req.headers["x-session-id"] || "");
    const chunkIndex = Number(req.body?.chunkIndex ?? req.headers["x-chunk-index"]);
    const session = activeUploadSessions.get(sessionId);

    if (!session || session.userId !== authUser.id) {
      return res.status(404).json({ error: "Upload session not found or expired" });
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: "Valid chunkIndex is required" });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Chunk binary payload is required" });
    }

    const result = await onceClient.uploadChunkRaw({
      chunkEndpoint: session.chunkEndpoint,
      uploadHeaderName: session.uploadHeaderName,
      uploadToken: session.uploadToken,
      sessionId: session.sessionId,
      chunkIndex,
      type: session.type,
      chunkBuffer: req.file.buffer,
    });

    res.json({ ok: true, chunkIndex, result });
  } catch (err: any) {
    console.error("[ONCE Chunk Upload] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/upload/complete", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const sessionId = String(req.body?.sessionId || "");
    const session = activeUploadSessions.get(sessionId);
    if (!session || session.userId !== authUser.id) {
      return res.status(404).json({ error: "Upload session not found or expired" });
    }

    const completed = await onceClient.completeChunkedUpload({
      completeEndpoint: session.completeEndpoint,
      uploadHeaderName: session.uploadHeaderName,
      uploadToken: session.uploadToken,
      sessionId: session.sessionId,
      fileName: session.fileName,
      fileType: session.fileType,
      type: session.type,
    });

    activeUploadSessions.delete(sessionId);

    onceStore.logAudit({
      actor_user_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.isAdmin ? "admin" : "artist",
      action: "asset_uploaded_chunked",
      status: "success",
      summary: `Completed chunked upload of ${session.fileName} (${session.type}) to ONCE`,
      details: { fileUrl: completed.fileUrl, fileType: session.fileType },
    });

    res.json({ ...completed, verified: Boolean(completed.fileUrl) });
  } catch (err: any) {
    console.error("[ONCE Complete Upload] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// -------------------------------------------------------------
// 4. Audio Intelligence (AI Detection & ACR Registry Match)
// -------------------------------------------------------------

onceRouter.post("/audio/ai-detection", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    if (!token) {
      return res.status(412).json({ code: "once_token_missing", error: "ONCE access token is not configured." });
    }
    const { file_url, file_name, release_id, track_index } = req.body;
    if (!file_url) {
      return res.status(400).json({ error: "file_url is required" });
    }

    const result = await onceClient.runAIDetection(
      { file_url, file_name, release_id, track_index },
      token
    );

    const creditCost = result.containsAi ? 2 : 1;

    res.json({
      ...result,
      creditCost,
      status: result.containsAi ? "ai_detected" : "human_made",
    });
  } catch (err: any) {
    console.error("[ONCE AI Detection] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/audio/acr-check", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    if (!token) {
      return res.status(412).json({ code: "once_token_missing", error: "ONCE access token is not configured." });
    }
    const { file_url, file_name } = req.body;
    if (!file_url) {
      return res.status(400).json({ error: "file_url is required" });
    }

    const result = await onceClient.runACRCheck({ file_url, file_name }, token);
    res.json(result);
  } catch (err: any) {
    console.error("[ONCE ACR Check] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// -------------------------------------------------------------
// 5. Validation, Drafts, Quotes, Submission & Tracking
// -------------------------------------------------------------

onceRouter.post("/releases/validate", async (req: Request, res: Response) => {
  try {
    const token = await resolveOptionalTokenFromReq(req);
    const { release, tracks, distributionMode } = req.body as {
      release?: Partial<OnceReleaseInput>;
      tracks?: Array<Partial<OnceTrackInput>>;
      distributionMode?: "once_api" | "manual_k70";
    };

    const report = await validateReleaseSubmission({
      release,
      tracks,
      distributionMode: distributionMode || "once_api",
      token,
    });
    res.json(report);
  } catch (err: any) {
    console.error("[ONCE Validate] Error:", err);
    res.status(500).json({ error: err.message || "Validation check failed" });
  }
});

onceRouter.get("/drafts", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const owned = await getUserOwnedReleases(authUser);
    const drafts = owned.filter((r) => ["draft", "pending_submission", "failed", "rejected"].includes(r.status));
    res.json(drafts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

onceRouter.get("/drafts/:id", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const id = String(req.params.id || "");
    const local = onceStore.getRelease(id);
    if (local) {
      if (local.user_id !== authUser.id && !authUser.isAdmin) {
        return res.status(403).json({ error: "You do not have permission to access this draft" });
      }
      return res.json(local);
    }

    const verified = await getVerifiedOwnedRelease(id, authUser);
    if ("error" in verified) {
      return res.status(verified.status).json({ error: verified.error });
    }
    res.json(verified.release);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

onceRouter.delete("/drafts/:id", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  const id = String(req.params.id || "");
  const deleted = onceStore.deleteDraft(id, authUser.id);
  if (!deleted) {
    return res.status(404).json({ error: "Draft not found or cannot be deleted after submission" });
  }

  onceStore.logAudit({
    actor_user_id: authUser.id,
    actor_email: authUser.email,
    actor_role: authUser.isAdmin ? "admin" : "artist",
    action: "draft_deleted",
    release_id: id,
    status: "info",
    summary: `Deleted draft ${id}`,
    details: {},
  });

  res.json({ success: true });
});

onceRouter.post("/drafts", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const draftPayload = req.body as DraftRequest;
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    const existingLocal = draftPayload.local_release_id ? onceStore.getRelease(draftPayload.local_release_id) : null;

    if (existingLocal && existingLocal.user_id !== authUser.id && !authUser.isAdmin) {
      return res.status(403).json({ error: "Cannot edit another user's draft" });
    }

    let onceDraftResult: {
      releaseId?: string;
      releaseCreated?: boolean;
      snapshot?: Record<string, unknown>;
      latest?: Record<string, unknown>;
      submittable?: boolean;
      submissionWarnings?: Array<Record<string, unknown>>;
    } | null = null;
    let onceDraftError: string | null = null;

    if (token && draftPayload.release?.title) {
      try {
        const cleanRelease = { ...draftPayload.release } as Partial<OnceReleaseInput>;
        delete (cleanRelease as any).cover_art_metadata;
        delete (cleanRelease as any).description;

        onceDraftResult = await onceClient.saveDraft(
          {
            release: cleanRelease as OnceReleaseInput,
            tracks: (draftPayload.tracks || []).map((t) => {
              const copy = { ...t } as any;
              delete copy.audio_metadata;
              return copy;
            }),
            mode: draftPayload.mode || "delta",
            release_id: existingLocal?.once_draft_id || draftPayload.once_draft_id || draftPayload.release_id,
            conversation_id: draftPayload.conversation_id,
          },
          token
        );
      } catch (err: any) {
        onceDraftError = err?.message || "Failed to sync draft with ONCE API";
      }
    }

    const releaseTitle = draftPayload.release?.title?.trim() || existingLocal?.title || "Untitled Draft";
    const primaryArtist =
      draftPayload.release?.primary_artist_name?.trim() || existingLocal?.primary_artist || "Draft Artist";
    const tracks = Array.isArray(draftPayload.tracks) ? draftPayload.tracks : [];
    const firstAudio = tracks[0]?.audio_file_url || existingLocal?.audio_url;

    const mergedMetadata = {
      ...(existingLocal?.metadata || {}),
      release: draftPayload.release || (existingLocal?.metadata as any)?.release || {},
      tracks,
      distributionMode: draftPayload.distribution_mode || (existingLocal?.metadata as any)?.distributionMode || "once_api",
      wizardState: draftPayload.wizard_state || (existingLocal?.metadata as any)?.wizardState || {},
      onceDraftError,
      onceDraftWarnings: onceDraftResult?.submissionWarnings || [],
    };

    let savedRecord;
    if (existingLocal) {
      savedRecord = onceStore.updateRelease(existingLocal.id, {
        title: releaseTitle,
        primary_artist: primaryArtist,
        release_type: draftPayload.release?.type || existingLocal.release_type || "single",
        cover_art_url: draftPayload.release?.cover_art_file_url || existingLocal.cover_art_url,
        audio_url: firstAudio,
        once_draft_id: onceDraftResult?.releaseId || existingLocal.once_draft_id,
        distribution_store_ids: Array.isArray(draftPayload.release?.distribution_store_ids)
          ? draftPayload.release.distribution_store_ids
          : existingLocal.distribution_store_ids,
        current_step: draftPayload.current_step || existingLocal.current_step || 1,
        metadata: mergedMetadata,
      });
    } else {
      savedRecord = onceStore.createRelease({
        id: crypto.randomUUID(),
        userId: authUser.id,
        release_id: draftPayload.release_id,
        once_draft_id: onceDraftResult?.releaseId || draftPayload.once_draft_id,
        title: releaseTitle,
        primaryArtist,
        release_type: draftPayload.release?.type || "single",
        cover_art_url: draftPayload.release?.cover_art_file_url,
        audio_url: firstAudio,
        distribution_store_ids: Array.isArray(draftPayload.release?.distribution_store_ids)
          ? draftPayload.release.distribution_store_ids
          : [],
        status: "draft",
        current_step: draftPayload.current_step || 1,
        metadata: mergedMetadata,
      });

      onceStore.logAudit({
        actor_user_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.isAdmin ? "admin" : "artist",
        action: "draft_created",
        release_id: savedRecord.id,
        once_release_id: savedRecord.once_draft_id || null,
        status: "info",
        summary: `Saved new release draft "${releaseTitle}"`,
        details: { currentStep: savedRecord.current_step, syncedToOnce: Boolean(onceDraftResult?.releaseId) },
      });
    }

    res.json({
      success: true,
      draft: savedRecord,
      onceDraftId: onceDraftResult?.releaseId || savedRecord?.once_draft_id || null,
      onceSyncStatus: onceDraftResult ? "synced" : token ? "sync_warning" : "local_only",
      onceSyncError: onceDraftError,
      onceWarnings: onceDraftResult?.submissionWarnings || [],
    });
  } catch (err: any) {
    console.error("[ONCE Draft Save] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/releases/quote", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
    const { tracks, local_release_id } = req.body as {
      tracks: OnceTrackInput[];
      local_release_id?: string;
    };

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "tracks array is required to price a release" });
    }

    if (!token) {
      return res.status(412).json({
        code: "once_token_missing",
        error: "ONCE API access token is not configured. Live ONCE quote and credit balance checks require a connected ONCE partner/user token.",
      });
    }

    const cleanTracks = tracks.map((t) => {
      const copy = { ...t } as any;
      delete copy.audio_metadata;
      return copy as OnceTrackInput;
    });

    const [quote, creditsInfo] = await Promise.all([
      onceClient.getReleaseQuote(cleanTracks, token),
      onceClient.getCredits(token).catch(() => null),
    ]);

    if (local_release_id) {
      const existing = onceStore.getRelease(local_release_id);
      if (existing && (existing.user_id === authUser.id || authUser.isAdmin)) {
        onceStore.updateRelease(existing.id, {
          last_quote: quote,
          credit_cost: quote?.cost?.totalCredits ?? existing.credit_cost,
        });
      }
    }

    onceStore.logAudit({
      actor_user_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.isAdmin ? "admin" : "artist",
      action: "quote_generated",
      release_id: local_release_id || null,
      status: quote?.balance?.covered ? "success" : "warning",
      summary: `Generated ONCE quote: ${quote?.cost?.totalCredits ?? "?"} credits ($${quote?.cost?.totalUsd ?? "?"})`,
      details: { quote, creditsInfo },
    });

    res.json({
      ...quote,
      accountCredits: creditsInfo?.credits ?? (quote as any)?.balance?.available ?? quote?.balance?.currentCredits ?? null,
    });
  } catch (err: any) {
    console.error("[ONCE Quote] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.post("/releases", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  const body = req.body as {
    release: OnceReleaseInput;
    tracks: OnceTrackInput[];
    release_id?: string;
    local_release_id?: string;
    once_draft_id?: string;
    rights_confirmed?: boolean;
    confirmed?: boolean;
    distribution_store_ids?: number[] | null;
  };

  const {
    release,
    tracks,
    release_id,
    local_release_id,
    once_draft_id,
    rights_confirmed,
    confirmed,
    distribution_store_ids,
  } = body;

  try {
    const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);

    if (!release || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "Release and at least one track are required" });
    }

    // Step 1: Full ONCE metadata-rules + release-schema validation
    const normalizedStoreIds =
      distribution_store_ids !== undefined ? distribution_store_ids : release.distribution_store_ids;
    const validationReport = await validateReleaseSubmission({
      release: { ...release, distribution_store_ids: normalizedStoreIds },
      tracks,
      distributionMode: "once_api",
      token,
    });

    if (!validationReport.valid) {
      if (local_release_id) {
        const draft = onceStore.getRelease(local_release_id);
        if (draft && draft.user_id === authUser.id) {
          onceStore.updateRelease(draft.id, { validation_errors: validationReport.errors });
        }
      }
      onceStore.logAudit({
        actor_user_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.isAdmin ? "admin" : "artist",
        action: "validation_failed",
        release_id: local_release_id || release_id || null,
        status: "warning",
        summary: `Blocked incomplete ONCE release submission (${validationReport.errors.length} error(s))`,
        details: { errors: validationReport.errors, missingFields: validationReport.missingFields },
      });

      return res.status(422).json({
        type: "validation_error",
        code: "once_validation_failed",
        message: validationReport.errors[0]?.message || "Release metadata is incomplete or invalid.",
        details: validationReport.errors,
        warnings: validationReport.warnings,
        missingFields: validationReport.missingFields,
      });
    }

    // Step 2: Require explicit artist confirmation & rights confirmation
    if (!rights_confirmed || !confirmed) {
      return res.status(400).json({
        type: "confirmation_required",
        code: "explicit_confirmation_required",
        message: "Please review your validation summary and confirm rights ownership before submitting.",
      });
    }

    // Step 3: Require live ONCE access token
    if (!token) {
      return res.status(412).json({
        type: "configuration_error",
        code: "once_token_missing",
        message: "ONCE API access token is not configured on the server. Save your release as a draft or use Zedbute Manual Distribution (K70).",
      });
    }

    // Step 4: Duplicate submission guard (within 10 minutes)
    const existingReleases = onceStore.listReleases(authUser.id);
    const duplicate = existingReleases.find(
      (r) =>
        r.id !== local_release_id &&
        r.title.toLowerCase() === release.title.toLowerCase() &&
        r.primary_artist.toLowerCase() === release.primary_artist_name.toLowerCase() &&
        r.submitted_at &&
        r.status !== "failed" &&
        r.status !== "rejected" &&
        Date.now() - new Date(r.submitted_at).getTime() < 10 * 60 * 1000
    );

    if (duplicate) {
      return res.status(409).json({
        type: "conflict_error",
        code: "duplicate_submission",
        message: `A release with this title was already submitted within the last 10 minutes (ONCE Release ID: ${duplicate.once_release_id || duplicate.id})`,
        onceReleaseId: duplicate.once_release_id,
      });
    }

    // Step 5: Import external HTTPS asset URLs into ONCE if they aren't already ONCE /api/files/... paths
    let coverArtFileUrl = release.cover_art_file_url;
    if (/^https:\/\//i.test(coverArtFileUrl) && !coverArtFileUrl.includes("once.app")) {
      const importedCover = await onceClient.importFileFromUrl(
        {
          type: "coverArt",
          url: coverArtFileUrl,
          file_name: `${release.title.replace(/[^a-zA-Z0-9_-]/g, "_") || "cover"}.jpg`,
        },
        token
      );
      coverArtFileUrl = importedCover.fileUrl;
    }

    const preparedTracks: OnceTrackInput[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const t = { ...tracks[i] };
      let audioFileUrl = t.audio_file_url;
      if (/^https:\/\//i.test(audioFileUrl) && !audioFileUrl.includes("once.app")) {
        const ext = audioFileUrl.split("?")[0].split(".").pop() || "wav";
        const importedAudio = await onceClient.importFileFromUrl(
          {
            type: "audio",
            url: audioFileUrl,
            file_name: `${t.title.replace(/[^a-zA-Z0-9_-]/g, "_") || `track_${i + 1}`}.${ext}`,
          },
          token
        );
        audioFileUrl = importedAudio.fileUrl;
      }
      const cleanTrack: any = { ...t, audio_file_url: audioFileUrl };
      delete cleanTrack.audio_metadata;
      preparedTracks.push(cleanTrack);
    }

    // Step 6: Check quote & credit coverage
    const quote = await onceClient.getReleaseQuote(preparedTracks, token);
    const covered = quote?.balance?.covered ?? (quote as any)?.balance?.covered;
    if (covered === false) {
      const required = quote?.cost?.totalCredits ?? (quote as any)?.balance?.required ?? preparedTracks.length;
      const available =
        (quote as any)?.balance?.available ?? quote?.balance?.currentCredits ?? 0;
      const deficit = (quote as any)?.balance?.shortfallCredits ?? quote?.balance?.deficitCredits ?? Math.max(0, required - available);
      const adminMessage = `Insufficient ONCE credits. Required: ${required}. Available: ${available}. Purchase credits to continue.`;

      if (local_release_id) {
        const draft = onceStore.getRelease(local_release_id);
        if (draft && draft.user_id === authUser.id) {
          onceStore.updateRelease(draft.id, {
            status: "pending",
            submission_error: adminMessage,
            last_quote: quote,
            credit_cost: required,
          });
        }
      }

      onceStore.logAudit({
        actor_user_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.isAdmin ? "admin" : "artist",
        action: "submission_blocked_credits",
        release_id: local_release_id || release_id || null,
        status: "warning",
        summary: `Blocked submission due to insufficient ONCE credits (${available}/${required})`,
        details: { quote },
      });

      return res.status(402).json({
        type: "insufficient_credits",
        code: "balance_insufficient",
        message: adminMessage,
        required,
        available,
        deficit,
        cost: quote.cost,
      });
    }

    // Step 7: Build clean ONCE SubmitReleaseRequest (respecting official OpenAPI fields)
    const cleanRelease: any = {
      ...release,
      cover_art_file_url: coverArtFileUrl,
      distribution_store_ids: normalizedStoreIds !== undefined ? normalizedStoreIds : null,
    };
    delete cleanRelease.cover_art_metadata;
    delete cleanRelease.description;
    if (!cleanRelease.upc) delete cleanRelease.upc;

    const submitPayload: SubmitReleaseRequest = {
      release: cleanRelease,
      tracks: preparedTracks,
      release_id: once_draft_id || release_id,
      rights_confirmed: true,
    };

    // Step 8: Submit to ONCE API
    const onceResult = await onceClient.submitRelease(submitPayload, token);

    const totalCost = quote?.cost?.totalCredits ?? preparedTracks.length;
    const targetStoreIds = Array.isArray(submitPayload.release.distribution_store_ids)
      ? submitPayload.release.distribution_store_ids
      : ONCE_FALLBACK_STORES.defaultStoreIds;

    let savedRecord;
    if (local_release_id && onceStore.getRelease(local_release_id)) {
      savedRecord = onceStore.updateRelease(local_release_id, {
        release_id,
        once_release_id: onceResult.releaseId,
        once_draft_id: once_draft_id || undefined,
        title: release.title,
        primary_artist: release.primary_artist_name,
        release_type: release.type || "single",
        upc: onceResult.upc || undefined,
        isrc: preparedTracks[0]?.isrc,
        cover_art_url: coverArtFileUrl,
        audio_url: preparedTracks[0]?.audio_file_url,
        metadata: { release, tracks: preparedTracks, tracksCount: preparedTracks.length, distributionMode: "once_api" },
        distribution_store_ids: targetStoreIds,
        status: onceResult.status || "processing",
        credit_cost: totalCost,
        credits_debited: totalCost,
        last_quote: quote,
        validation_errors: [],
        submission_error: undefined,
        submitted_at: new Date().toISOString(),
      });
    } else {
      savedRecord = onceStore.createRelease({
        userId: authUser.id,
        release_id,
        once_release_id: onceResult.releaseId,
        once_draft_id,
        title: release.title,
        primaryArtist: release.primary_artist_name,
        release_type: release.type || "single",
        upc: onceResult.upc || undefined,
        isrc: preparedTracks[0]?.isrc,
        cover_art_url: coverArtFileUrl,
        audio_url: preparedTracks[0]?.audio_file_url,
        metadata: { release, tracks: preparedTracks, tracksCount: preparedTracks.length, distributionMode: "once_api" },
        distribution_store_ids: targetStoreIds,
        status: onceResult.status || "processing",
        credit_cost: totalCost,
        credits_debited: totalCost,
        last_quote: quote,
        validation_errors: [],
        submitted_at: new Date().toISOString(),
      });
    }

    // Update linked music_releases status if present
    const adminDb = getSupabaseAdmin();
    if (adminDb && release_id) {
      await adminDb
        .from("music_releases")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", release_id);
    }

    onceStore.logAudit({
      actor_user_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.isAdmin ? "admin" : "artist",
      action: "release_submitted",
      release_id: savedRecord?.id || release_id || null,
      once_release_id: onceResult.releaseId,
      status: "success",
      summary: `Submitted "${release.title}" to ONCE Distribution Engine (ID: ${onceResult.releaseId})`,
      details: {
        status: onceResult.status,
        upc: onceResult.upc,
        creditsDebited: totalCost,
        tracksCount: preparedTracks.length,
      },
    });

    res.status(201).json({
      success: true,
      message: "Release submitted successfully to ONCE Distribution Engine",
      releaseRecord: savedRecord,
      onceReleaseId: onceResult.releaseId,
      status: onceResult.status,
      upc: onceResult.upc,
    });
  } catch (err: any) {
    console.error("[ONCE Submit] Error:", err);
    const errMsg = err?.message || "Failed to submit release to ONCE";

    if (local_release_id && onceStore.getRelease(local_release_id)) {
      onceStore.updateRelease(local_release_id, {
        status: "failed",
        submission_error: errMsg,
      });
    }

    onceStore.logAudit({
      actor_user_id: authUser.id,
      actor_email: authUser.email,
      actor_role: authUser.isAdmin ? "admin" : "artist",
      action: "submission_failed",
      release_id: local_release_id || release_id || null,
      status: "error",
      summary: `ONCE submission failed for "${release?.title || "Release"}"`,
      error_message: errMsg,
      details: { code: err?.code, type: err?.type, apiDetails: err?.details },
    });

    res.status(err.status || 500).json({
      error: errMsg,
      code: err.code,
      type: err.type,
      details: err.details,
    });
  }
});

onceRouter.get("/releases", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;
    if (authUser.isAdmin && !req.query.userId) {
      const all = await getAllManagedReleases(authUser);
      return res.json(all);
    }
    const owned = await getUserOwnedReleases(authUser);
    return res.json(owned);
  }
  const userId = req.query.userId as string | undefined;
  const records = onceStore.listReleases(userId);
  res.json(records);
});

onceRouter.get("/releases/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const authUser = await requireAuthenticatedUser(req, res);
    if (!authUser) return;
    if (authUser.isAdmin) {
      const all = await getAllManagedReleases(authUser);
      const found = all.find((r) => r.id === id || r.once_release_id === id || r.release_id === id);
      if (!found) return res.status(404).json({ error: "Release not found" });
      return res.json(found);
    }
    const verified = await getVerifiedOwnedRelease(id, authUser);
    if ("error" in verified) return res.status(verified.status).json({ error: verified.error });
    return res.json(verified.release);
  }

  const record = onceStore.getRelease(id) || onceStore.getReleaseByOnceId(id);
  if (!record) {
    return res.status(404).json({ error: "Release not found" });
  }
  res.json(record);
});

onceRouter.get("/releases/:id/status", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const token = await resolveOptionalTokenFromReq(req);
    const record = onceStore.getRelease(id) || onceStore.getReleaseByOnceId(id);
    const onceId = record?.once_release_id || id;

    const liveStatus = await onceClient.getReleaseStatus(onceId, token);

    if (record) {
      onceStore.updateRelease(record.id, {
        status: liveStatus.aggregateStatus || record.status,
        store_statuses: liveStatus.storeStatuses || record.store_statuses,
        artist_profiles: liveStatus.artistProfiles || record.artist_profiles,
      });
      onceStore.logAudit({
        actor_role: "system",
        action: "status_synced",
        release_id: record.id,
        once_release_id: onceId,
        status: "info",
        summary: `Synced status for "${record.title}": ${liveStatus.aggregateStatus}`,
        details: { storeCount: liveStatus.storeStatuses?.length || 0 },
      });
    }

    res.json(liveStatus);
  } catch (err: any) {
    console.error("[ONCE Get Status] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.get("/releases/:id/job", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const token = await resolveOptionalTokenFromReq(req);
    const record = onceStore.getRelease(id) || onceStore.getReleaseByOnceId(id);
    const onceId = record?.once_release_id || id;

    const job = await onceClient.getReleaseJob(onceId, token);
    res.json(job);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// -------------------------------------------------------------
// 6. Webhook Receiver & Registration
// -------------------------------------------------------------

onceRouter.post("/webhook", onceWebhookHandler);

onceRouter.post("/webhooks/register", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(adminUser.id, adminUser.dbClient);
    const { url, description, event_types } = req.body;
    if (!url || typeof url !== "string" || !url.startsWith("https://")) {
      return res.status(400).json({ error: "A valid https:// webhook url is required" });
    }

    const result = await onceClient.registerWebhook(
      {
        url,
        description: description || "Zedbute ONCE Distribution Engine Webhook Listener",
        event_types: event_types || ["release.status_changed", "release.approved"],
      },
      token
    );

    onceStore.logAudit({
      actor_user_id: adminUser.id,
      actor_email: adminUser.email,
      actor_role: "admin",
      action: "webhook_registered",
      status: "success",
      summary: `Registered ONCE webhook URL: ${url}`,
      details: { webhookId: result.id },
    });

    res.status(201).json({
      id: result.id,
      url: result.url,
      registered: true,
      secretConfiguredInEnv: Boolean(process.env.ONCE_WEBHOOK_SECRET),
      message: "Webhook registered with ONCE. Store the signing secret from ONCE Developer settings in ONCE_WEBHOOK_SECRET.",
    });
  } catch (err: any) {
    console.error("[ONCE Register Webhook] Error:", err);
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

onceRouter.get("/webhooks", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const { token } = await resolveOnceTokenForUser(adminUser.id, adminUser.dbClient);
    const endpoints = token ? await onceClient.listWebhooks(token).catch(() => []) : [];
    const localEvents = onceStore.listWebhookEvents(20);
    res.json({ endpoints, recentEvents: localEvents });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Admin Dashboard, Submission Review & Audit Logs
// -------------------------------------------------------------

onceRouter.get("/admin/metrics", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const metrics = onceStore.getMetrics();
    let onceCredits: any = null;
    let creditBalance: number | null = null;

    if (process.env.ONCE_ACCESS_TOKEN || process.env.ONCE_CLIENT_ID) {
      try {
        onceCredits = await onceClient.getCredits();
        if (typeof onceCredits?.credits === "number") {
          creditBalance = onceCredits.credits;
        } else if (typeof onceCredits?.balance === "number") {
          creditBalance = onceCredits.balance;
        }
      } catch (e: any) {
        onceCredits = { error: e.message };
      }
    }

    const allReleases = Object.values(onceStore.getAllReleases?.() || onceStore.listReleases() || {});
    const financialSummary = await calculateZedbuteFinancialSummary(allReleases, creditBalance);

    if (financialSummary.lowCreditWarning) {
      onceStore.logAudit({
        actor_role: "system",
        action: "low_credit_alert",
        status: "warning",
        summary: `ONCE credit balance is running low (${financialSummary.remainingOnceCredits} credits remaining)`,
        details: { remainingCredits: financialSummary.remainingOnceCredits },
      });
    }

    const settings = onceStore.getSettings();
    const webhooks = onceStore.listWebhookEvents(10);

    res.json({
      metrics,
      onceCredits,
      financialSummary,
      settings,
      recentWebhooks: webhooks,
      webhookSecretConfigured: Boolean(process.env.ONCE_WEBHOOK_SECRET),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

onceRouter.get("/admin/releases", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const releases = await getAllManagedReleases(adminUser);
    res.json(releases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

onceRouter.get("/admin/audit-logs", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const releaseId = typeof req.query.releaseId === "string" ? req.query.releaseId : undefined;
    const limit = req.query.limit ? Math.min(500, Math.max(1, Number(req.query.limit))) : 150;

    const localLogs = onceStore.listAuditLogs({ action, status, releaseId, limit });
    let dbLogs: OnceAuditLogRecord[] = [];
    const reader = getSupabaseAdmin() || adminUser.dbClient;

    try {
      let query = reader
        .from("once_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (action && action !== "all") query = query.eq("action", action);
      if (status && status !== "all") query = query.eq("status", status);
      if (releaseId) query = query.eq("release_id", releaseId);
      const { data } = await query;
      if (Array.isArray(data)) {
        dbLogs = data as OnceAuditLogRecord[];
      }
    } catch {
      // Table may not yet be migrated; local store logs still serve cleanly
    }

    const merged = new Map<string, OnceAuditLogRecord>();
    for (const log of [...dbLogs, ...localLogs]) {
      if (!merged.has(log.id)) merged.set(log.id, log);
    }

    const sorted = Array.from(merged.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

onceRouter.post("/admin/review/:id", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const id = String(req.params.id);
    const { action, notes } = req.body as {
      action: "approve_and_submit" | "approve_manual" | "reject" | "sync_status";
      notes?: string;
    };

    let record = onceStore.getRelease(id);
    if (!record) {
      const managed = await getAllManagedReleases(adminUser);
      const found = managed.find((r) => r.id === id || r.once_release_id === id || r.release_id === id);
      if (found) {
        record = onceStore.createRelease({
          ...found,
          userId: found.user_id,
          primaryArtist: found.primary_artist,
        });
      }
    }
    if (!record) {
      return res.status(404).json({ error: "Release not found in distribution engine" });
    }

    if (action === "reject") {
      const reason = notes?.trim() || "Rejected by Zedbute administrator during metadata/quality review.";
      const updated = onceStore.updateRelease(record.id, {
        status: "rejected",
        submission_error: reason,
        review_notes: reason,
        reviewed_by: adminUser.email || adminUser.id,
        reviewed_at: new Date().toISOString(),
      });

      onceStore.logAudit({
        actor_user_id: adminUser.id,
        actor_email: adminUser.email,
        actor_role: "admin",
        action: "admin_rejected",
        release_id: record.id,
        once_release_id: record.once_release_id || null,
        status: "warning",
        summary: `Rejected "${record.title}"`,
        error_message: reason,
        details: { notes: reason },
      });

      return res.json({ success: true, message: "Release marked as rejected", release: updated });
    }

    if (action === "approve_manual") {
      const updated = onceStore.updateRelease(record.id, {
        status: "approved",
        submission_error: undefined,
        review_notes: notes || "Approved by administrator",
        reviewed_by: adminUser.email || adminUser.id,
        reviewed_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      });

      onceStore.logAudit({
        actor_user_id: adminUser.id,
        actor_email: adminUser.email,
        actor_role: "admin",
        action: "admin_approved",
        release_id: record.id,
        once_release_id: record.once_release_id || null,
        status: "success",
        summary: `Approved "${record.title}"`,
        details: { notes },
      });

      return res.json({ success: true, message: "Release approved", release: updated });
    }

    if (action === "sync_status") {
      const onceId = record.once_release_id;
      if (!onceId) {
        return res.status(400).json({ error: "Release has not been submitted to ONCE yet (no ONCE release ID)." });
      }
      const { token } = await resolveOnceTokenForUser(record.user_id, adminUser.dbClient);
      const liveStatus = await onceClient.getReleaseStatus(onceId, token);
      const updated = onceStore.updateRelease(record.id, {
        status: liveStatus.aggregateStatus || record.status,
        store_statuses: liveStatus.storeStatuses || record.store_statuses,
        artist_profiles: liveStatus.artistProfiles || record.artist_profiles,
      });

      onceStore.logAudit({
        actor_user_id: adminUser.id,
        actor_email: adminUser.email,
        actor_role: "admin",
        action: "status_synced",
        release_id: record.id,
        once_release_id: onceId,
        status: "info",
        summary: `Admin synced "${record.title}" status: ${liveStatus.aggregateStatus}`,
        details: { aggregateStatus: liveStatus.aggregateStatus },
      });

      return res.json({ success: true, message: `Synced status: ${liveStatus.aggregateStatus}`, release: updated });
    }

    if (action === "approve_and_submit") {
      const { token } = await resolveOnceTokenForUser(record.user_id, adminUser.dbClient);
      if (!token) {
        return res.status(412).json({
          code: "once_token_missing",
          error: "ONCE API access token is not configured on the server.",
        });
      }

      const meta = (record.metadata || {}) as { release?: OnceReleaseInput; tracks?: OnceTrackInput[] };
      const releaseInput = meta.release;
      const tracksInput = meta.tracks || [
        {
          title: record.title,
          audio_file_url: record.audio_url || "",
          explicit_flag: false,
          writers: [{ name: record.primary_artist }],
        },
      ];

      if (!releaseInput) {
        return res.status(422).json({ error: "Release metadata is missing from draft." });
      }

      const validation = await validateReleaseSubmission({
        release: releaseInput,
        tracks: tracksInput,
        distributionMode: "once_api",
        token,
      });
      if (!validation.valid) {
        onceStore.updateRelease(record.id, { validation_errors: validation.errors });
        return res.status(422).json({
          code: "once_validation_failed",
          error: validation.errors[0]?.message || "Release failed ONCE validation checks.",
          details: validation.errors,
        });
      }

      const cleanRelease: any = { ...releaseInput };
      delete cleanRelease.cover_art_metadata;
      delete cleanRelease.description;
      if (!cleanRelease.upc) delete cleanRelease.upc;

      const cleanTracks = tracksInput.map((t) => {
        const copy = { ...t } as any;
        delete copy.audio_metadata;
        return copy as OnceTrackInput;
      });

      const onceResult = await onceClient.submitRelease(
        {
          release: cleanRelease,
          tracks: cleanTracks,
          release_id: record.once_draft_id || record.release_id,
          rights_confirmed: true,
        },
        token
      );

      const updated = onceStore.updateRelease(record.id, {
        once_release_id: onceResult.releaseId,
        status: onceResult.status || "processing",
        upc: onceResult.upc || record.upc,
        submission_error: undefined,
        validation_errors: [],
        review_notes: notes || "Reviewed and dispatched to ONCE by admin",
        reviewed_by: adminUser.email || adminUser.id,
        reviewed_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      });

      onceStore.logAudit({
        actor_user_id: adminUser.id,
        actor_email: adminUser.email,
        actor_role: "admin",
        action: "admin_approved_and_submitted",
        release_id: record.id,
        once_release_id: onceResult.releaseId,
        status: "success",
        summary: `Admin approved and submitted "${record.title}" to ONCE (${onceResult.releaseId})`,
        details: { notes, status: onceResult.status },
      });

      return res.json({ success: true, message: "Release approved and submitted to ONCE", release: updated });
    }

    res.status(400).json({ error: "Unsupported review action" });
  } catch (err: any) {
    const errMsg = err?.message || "Admin review action failed";
    onceStore.updateRelease(String(req.params.id), {
      submission_error: errMsg,
      status: "failed",
    });
    onceStore.logAudit({
      actor_user_id: adminUser.id,
      actor_email: adminUser.email,
      actor_role: "admin",
      action: "submission_failed",
      release_id: String(req.params.id),
      status: "error",
      summary: "Admin submission to ONCE failed",
      error_message: errMsg,
      details: { code: err?.code },
    });
    res.status(err.status || 500).json({ error: errMsg, code: err.code, details: err.details });
  }
});

onceRouter.get("/admin/settings", (_req: Request, res: Response) => {
  res.json(onceStore.getSettings());
});

onceRouter.post("/admin/settings", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const updated = onceStore.updateSettings(req.body);
    onceStore.logAudit({
      actor_user_id: adminUser.id,
      actor_email: adminUser.email,
      actor_role: "admin",
      action: "settings_updated",
      status: "info",
      summary: `Updated engine settings (Single fee: K${updated.single_upload_price_zmw})`,
      details: { ...updated },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

onceRouter.post("/admin/retry/:id", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const id = String(req.params.id);
    let record = onceStore.getRelease(id);
    if (!record) {
      const managed = await getAllManagedReleases(adminUser);
      const found = managed.find((r) => r.id === id || r.once_release_id === id || r.release_id === id);
      if (found) {
        record = onceStore.createRelease({
          ...found,
          userId: found.user_id,
          primaryArtist: found.primary_artist,
        });
      }
    }
    if (!record) {
      return res.status(404).json({ error: "Release not found" });
    }

    const { token } = await resolveOnceTokenForUser(record.user_id, adminUser.dbClient);
    if (!token) {
      return res.status(412).json({ code: "once_token_missing", error: "ONCE API access token is not configured." });
    }

    if (!["failed", "rejected", "pending"].includes(record.status)) {
      return res.status(400).json({ error: "Only pending, failed, or rejected releases can be retried" });
    }

    const metadata = record.metadata as any;
    if (!metadata?.release) {
      return res.status(422).json({ error: "Metadata is missing for retry" });
    }

    const cleanRelease = { ...metadata.release };
    delete cleanRelease.cover_art_metadata;
    delete cleanRelease.description;
    if (!cleanRelease.upc) delete cleanRelease.upc;

    const retryTracks = (metadata.tracks || metadata.release.tracks || [
      {
        title: record.title,
        audio_file_url: record.audio_url || "",
        explicit_flag: false,
        writers: [{ name: record.primary_artist }],
      },
    ]).map((t: any) => {
      const copy = { ...t };
      delete copy.audio_metadata;
      return copy;
    });

    const retryPayload: SubmitReleaseRequest = {
      release: cleanRelease,
      tracks: retryTracks,
      release_id: record.release_id,
      rights_confirmed: true,
    };

    const onceResult = await onceClient.submitRelease(retryPayload, token);

    const updated = onceStore.updateRelease(record.id, {
      once_release_id: onceResult.releaseId,
      status: onceResult.status || "processing",
      submission_error: undefined,
      submitted_at: new Date().toISOString(),
    });

    onceStore.logAudit({
      actor_user_id: adminUser.id,
      actor_email: adminUser.email,
      actor_role: "admin",
      action: "admin_retried",
      release_id: record.id,
      once_release_id: onceResult.releaseId,
      status: "success",
      summary: `Admin retried submission "${record.title}" (${onceResult.releaseId})`,
      details: { status: onceResult.status },
    });

    res.json({
      success: true,
      message: "Release retry submitted successfully",
      release: updated,
    });
  } catch (err: any) {
    const errMsg = err?.message || "Failed to retry submission";
    onceStore.updateRelease(String(req.params.id), { submission_error: errMsg });
    onceStore.logAudit({
      actor_user_id: adminUser.id,
      actor_email: adminUser.email,
      actor_role: "admin",
      action: "submission_failed",
      release_id: String(req.params.id),
      status: "error",
      summary: "Admin retry failed",
      error_message: errMsg,
      details: { code: err?.code },
    });
    res.status(err.status || 500).json({ error: errMsg, code: err.code });
  }
});

// -------------------------------------------------------------
// 8. ONCE MCP Performance Analytics (Artist & Admin Scoped)
// -------------------------------------------------------------

onceRouter.get("/analytics/summary", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const dateRange = validateAnalyticsDateRange({
      range: typeof req.query.range === "string" ? req.query.range : undefined,
      fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
      toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
    });

    const payload = await buildArtistAnalyticsOverview(authUser, dateRange);
    res.json(payload);
  } catch (err: unknown) {
    if (err instanceof OnceMcpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    const message = err instanceof Error ? err.message : "Failed to load artist performance analytics";
    console.error("[ONCE Analytics Summary] Error:", message);
    res.status(500).json({ error: message });
  }
});

onceRouter.get("/analytics/releases/:releaseId", async (req: Request, res: Response) => {
  const authUser = await requireAuthenticatedUser(req, res);
  if (!authUser) return;

  try {
    const releaseId = String(req.params.releaseId || "");
    const dateRange = validateAnalyticsDateRange({
      range: typeof req.query.range === "string" ? req.query.range : undefined,
      fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
      toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
    });

    let distributorId: number | undefined = undefined;
    if (typeof req.query.distributorId === "string" && req.query.distributorId.trim() !== "") {
      const parsed = Number(req.query.distributorId);
      if (!Number.isInteger(parsed)) {
        return res.status(400).json({ error: "distributorId must be an integer store ID" });
      }
      distributorId = parsed;
    }

    const payload = await buildReleaseAnalytics(authUser, releaseId, dateRange, distributorId);
    res.json(payload);
  } catch (err: unknown) {
    if (err instanceof OnceMcpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    const message = err instanceof Error ? err.message : "Failed to load release performance analytics";
    console.error("[ONCE Release Analytics] Error:", message);
    res.status(500).json({ error: message });
  }
});

onceRouter.get("/analytics/admin/summary", async (req: Request, res: Response) => {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const dateRange = validateAnalyticsDateRange({
      range: typeof req.query.range === "string" ? req.query.range : undefined,
      fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
      toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
    });

    const payload = await buildAdminAnalyticsOverview(adminUser, dateRange);
    res.json(payload);
  } catch (err: unknown) {
    if (err instanceof OnceMcpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    const message = err instanceof Error ? err.message : "Failed to load admin analytics overview";
    console.error("[ONCE Admin Analytics] Error:", message);
    res.status(500).json({ error: message });
  }
});
