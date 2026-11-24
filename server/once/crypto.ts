import crypto from "crypto";

/**
 * Generate PKCE code_verifier (43-128 chars, url-safe).
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Generate S256 code_challenge from code_verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// In-memory or fallback secret for AES-256 token encryption
let cachedKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const rawSecret = process.env.ONCE_TOKEN_ENCRYPTION_KEY || process.env.STRIPE_SECRET_KEY || "zedbute-once-partner-token-key-2026";
  cachedKey = crypto.createHash("sha256").update(rawSecret).digest();
  return cachedKey;
}

/**
 * Encrypt access or refresh tokens using AES-256-GCM.
 */
export function encryptToken(token: string): string {
  if (!token) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  let encrypted = cipher.update(token, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt tokens using AES-256-GCM.
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  try {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encryptedData] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[ONCE Crypto] Failed to decrypt token:", err);
    return "";
  }
}

/**
 * Verify ONCE webhook signature:
 * Header: `x-once-signature: sha256=<hex>`
 * Computes HMAC-SHA256 over the exact raw request body using the endpoint's signing secret.
 * Uses timingSafeEqual to prevent timing side-channel leaks.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || typeof signatureHeader !== "string" || !secret) {
    return false;
  }

  const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
    return false;
  }

  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) {
    return false;
  }

  const signatureHex = signatureHeader.slice(expectedPrefix.length).trim();
  if (!/^[0-9a-f]{64}$/i.test(signatureHex)) {
    return false;
  }

  const calculatedHex = crypto
    .createHmac("sha256", secret)
    .update(bodyBuffer)
    .digest("hex");

  const sigBuf = Buffer.from(signatureHex, "hex");
  const calcBuf = Buffer.from(calculatedHex, "hex");

  if (sigBuf.length !== calcBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, calcBuf);
}

/**
 * Compute deterministic SHA-256 digest of a raw payload for idempotent deduplication.
 */
export function computePayloadDigest(rawBody: Buffer | string): string {
  const buf = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  return crypto.createHash("sha256").update(buf).digest("hex");
}
