import { onceClient } from "./client";
import type {
  AudioFileInspection,
  CoverArtInspection,
  DistributionStoresResponse,
  OnceReleaseInput,
  OnceTrackInput,
  ValidationIssue,
  ValidationReport,
} from "./types";

// Official ONCE upload & asset limits (from https://docs.once.app/user-guide/releasing-music, /faq, /mcp/uploads)
export const ONCE_AUDIO_REQUIREMENTS = {
  acceptedFormats: ["WAV", "FLAC", "MP3", "AAC", "M4A", "OGG", "AIFF", "MP4"],
  acceptedExtensions: [".wav", ".flac", ".mp3", ".aac", ".m4a", ".ogg", ".aiff", ".aif", ".mp4"],
  acceptedMimePrefixes: [
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/flac",
    "audio/x-flac",
    "audio/mpeg",
    "audio/mp3",
    "audio/aac",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/ogg",
    "audio/aiff",
    "audio/x-aiff",
    "video/mp4",
  ],
  recommendedFormat: "WAV (16-bit or 24-bit, 44.1 kHz+)",
  maxFileSizeBytes: 1024 * 1024 * 1024, // 1 GB per ONCE FAQ / Releasing Music guide (200 MB chunk/MCP recommended)
  recommendedMaxFileSizeBytes: 200 * 1024 * 1024,
  chunkThresholdBytes: 4 * 1024 * 1024, // Use chunked upload session above 4 MB
  recommendedChunkBytes: 5 * 1024 * 1024,
  minSampleRateHz: 44100,
  recommendedSampleRateHz: 44100,
  minBitDepth: 16,
  minDurationSeconds: 10,
  recommendedMinDurationSeconds: 30,
};

export const ONCE_COVER_ART_REQUIREMENTS = {
  acceptedFormats: ["JPEG", "PNG"],
  acceptedMimeTypes: ["image/jpeg", "image/jpg", "image/png"],
  acceptedExtensions: [".jpg", ".jpeg", ".png"],
  minDimensionPx: 1400, // Modern DSP/ONCE standard (recommended 3000x3000)
  recommendedDimensionPx: 3000,
  maxDimensionPx: 6000,
  aspectRatio: 1, // Strict 1:1 square
  maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB max per ONCE upload limits
};

// Accurate fallback matching live GET https://once.app/v1/distribution-stores
export const ONCE_FALLBACK_STORES: DistributionStoresResponse = {
  stores: [
    { storeId: 1, name: "Apple Music", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["itunes", "apple"] },
    { storeId: 9, name: "Spotify", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["spotify"] },
    { storeId: 13, name: "YouTube Music", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["youtube", "yt"] },
    { storeId: 319, name: "TikTok", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["tiktok", "bytedance"] },
    { storeId: 321, name: "Boomplay", featured: true, enabledByDefault: true, partnerOnly: false, aliases: ["boomplay"] },
    { storeId: 334, name: "Audiomack", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["audiomack"] },
    { storeId: 17, name: "Amazon", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["amazon", "amazon music"] },
    { storeId: 14, name: "Tidal", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["tidal"] },
    { storeId: 68, name: "SoundCloud", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["soundcloud"] },
    { storeId: 41, name: "Pandora", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["pandora"] },
    { storeId: 85, name: "iHeartRadio", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["iheart", "iheartradio"] },
    { storeId: 91, name: "Anghami", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["anghami"] },
    { storeId: 110, name: "Jiosaavn", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["jiosaavn", "saavn"] },
    { storeId: 323, name: "Snap", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["snap", "snapchat"] },
    { storeId: 309, name: "Facebook Audio Library", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["facebook", "instagram", "meta"] },
    { storeId: 315, name: "Mixcloud", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["mixcloud"] },
    { storeId: 371, name: "JOOX", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["joox"] },
    { storeId: 45, name: "KKBOX", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["kkbox"] },
    { storeId: 19, name: "Nuuday", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["nuuday", "yousee"] },
    { storeId: 52, name: "iMusica", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["imusica"] },
    { storeId: 130, name: "AWA", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["awa"] },
    { storeId: 264, name: "NetEase", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["netease"] },
    { storeId: 324, name: "Peloton", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["peloton"] },
    { storeId: 416, name: "Flo", featured: false, enabledByDefault: true, partnerOnly: false, aliases: ["flo"] },
    { storeId: 307, name: "YouTube Content ID", featured: false, enabledByDefault: false, partnerOnly: true, aliases: ["youtube cid", "content id"] },
    { storeId: 310, name: "Facebook Rights Manager", featured: false, enabledByDefault: false, partnerOnly: true, aliases: ["fb rights", "meta rights"] },
  ],
  defaultStoreIds: [1, 9, 13, 319, 321, 334, 17, 14, 68, 41, 85, 91, 110, 323, 309, 315, 371, 45, 19, 52, 130, 264, 324, 416],
  selectionSemantics: "Pass a non-empty array of supported DSP store IDs or null for all supported stores. Empty array is invalid.",
};

// Official ONCE Release Schema derived strictly from https://once.app/v1/openapi.json
export const ONCE_OPENAPI_RELEASE_SCHEMA: Record<string, unknown> = {
  source: "openapi_spec",
  version: "1.0.0",
  requiredReleaseFields: [
    "title",
    "primary_artist_name",
    "genre",
    "release_date",
    "cover_art_file_url",
  ],
  recommendedModernReleaseFields: [
    "distribution_store_ids",
    "label",
    "audio_language",
    "metadata_language",
    "pline_year",
    "pline_owner",
    "cline_year",
    "cline_owner",
    "contributors",
  ],
  requiredTrackFields: [
    "title",
    "audio_file_url",
    "explicit_flag",
    "writers",
  ],
  recommendedModernTrackFields: [
    "track_type",
    "language",
    "pline_year",
    "pline_owner",
    "cline_year",
    "cline_owner",
    "contributors",
    "preview_start_seconds",
  ],
  audioRequirements: ONCE_AUDIO_REQUIREMENTS,
  coverArtRequirements: ONCE_COVER_ART_REQUIREMENTS,
  enums: {
    releaseType: ["single", "ep", "album"],
    trackType: ["original", "cover", "public_domain"],
    contributorSongwriterRoles: ["Songwriter", "Composer", "Lyricist", "Writer"],
    contributorProfessionalRoles: ["Producer", "Engineer", "Remixer", "Featuring", "Mixing", "Mastering"],
  },
};

const GENERIC_ARTIST_PATTERNS = [
  /^asmr$/i,
  /^binaural beats?$/i,
  /^edm$/i,
  /^healing meditation frequency$/i,
  /^solfeggio frequencies( tones)?$/i,
  /^christmas (music|songs)$/i,
  /^yoga music$/i,
  /^study music$/i,
  /^sleep music$/i,
  /^kinderliedjes$/i,
  /^kindermuziek$/i,
  /^children'?s music$/i,
  /^gaming music$/i,
  /^holiday music$/i,
  /^nature sounds$/i,
  /^white noise$/i,
  /^lofi chill beats$/i,
  /^chill beats$/i,
  /^relaxing music$/i,
];

const PLACEHOLDER_TITLE_PATTERNS = [
  /^track\s*\d*$/i,
  /^untitled(\s*\d*)?$/i,
  /^song\s*\d*$/i,
  /^audio\s*\d*$/i,
  /^test(\s*\d*)?$/i,
  /\.(wav|mp3|flac|aac|m4a|ogg|aiff|mp4)$/i,
];

const UGC_RESTRICTED_LANGUAGES = new Set(["hi", "ur", "id", "vi", "pt", "pt-br", "tr"]);
const UGC_STORE_IDS = new Set([307, 310]);

// Regex for emojis, copyright (©), trademark (™). Note: ® and ℗ are allowed per ONCE docs!
const FORBIDDEN_SYMBOL_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}©™]/u;

// Valid CJK / Kana / Hangul check (matches ONCE rule: single-char parts / unspaced names allowed in Han/Kana/Hangul)
const CJK_KANA_HANGUL_REGEX = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

let cachedRules: { value: { markdown: string; source: "live" | "cached_spec" }; fetchedAt: number } | null = null;
let cachedSchema: { value: Record<string, unknown>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getOnceMetadataRulesWithCache(): Promise<{ markdown: string; source: "live" | "cached_spec" }> {
  if (cachedRules && Date.now() - cachedRules.fetchedAt < CACHE_TTL_MS) {
    return cachedRules.value;
  }
  try {
    const res = await onceClient.getMetadataRules();
    const val = { markdown: res.markdown || "", source: "live" as const };
    cachedRules = { value: val, fetchedAt: Date.now() };
    return val;
  } catch {
    return {
      markdown:
        "# ONCE Metadata Rules\n\n- Provide a real performing artist name (no generic genre/mood search names).\n- Every track needs at least one writer with a full legal name (first and last name).\n- Set track_type to original, cover, or public_domain.\n- Provide release & track C-line/P-line copyright owner & year and Producer/Engineer contributors.\n- Square JPG/PNG cover art (3000x3000 recommended, min 1400x1400).\n- Supported audio: WAV (16/24-bit, 44.1 kHz+ recommended), FLAC, MP3, AAC, M4A, OGG, AIFF, MP4.",
      source: "cached_spec",
    };
  }
}

export async function getOnceReleaseSchemaWithCache(token?: string): Promise<{
  schema: Record<string, unknown>;
  source: "live" | "openapi_spec";
}> {
  if (cachedSchema && Date.now() - cachedSchema.fetchedAt < CACHE_TTL_MS && !token) {
    return { schema: cachedSchema.value, source: "openapi_spec" };
  }
  if (token) {
    try {
      const liveSchema = await onceClient.getReleaseSchema(token);
      return {
        schema: {
          ...ONCE_OPENAPI_RELEASE_SCHEMA,
          liveOnceSchema: liveSchema,
          source: "live",
        },
        source: "live",
      };
    } catch {
      // Fall back cleanly to authoritative OpenAPI schema when ONCE /release-schema returns 401 or network error
    }
  }
  cachedSchema = { value: ONCE_OPENAPI_RELEASE_SCHEMA, fetchedAt: Date.now() };
  return { schema: ONCE_OPENAPI_RELEASE_SCHEMA, source: "openapi_spec" };
}

export function isFullLegalName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (CJK_KANA_HANGUL_REGEX.test(trimmed)) {
    // ONCE allows Han/Kana/Hangul names with single characters or without whitespace separators
    return trimmed.length >= 2;
  }
  const parts = trimmed.split(/[\s\u3000\u30FB]+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((part) => part.replace(/['’.-]/g, "").length >= 2);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidIsrc(isrc: string): boolean {
  const normalized = isrc.replace(/[-\s]/g, "").toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(normalized);
}

export function isValidSpotifyArtistUrl(url: string): boolean {
  return /^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+(\?.*)?$/.test(url.trim());
}

export function isValidAppleMusicArtistUrl(url: string): boolean {
  return /^https:\/\/music\.apple\.com\/[a-z]{2}\/artist\/[^/]+\/\d+(\?.*)?$/i.test(url.trim());
}

export function validateAudioMetadata(
  audioMeta: AudioFileInspection | undefined,
  trackIndex: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!audioMeta) return issues;
  const prefix = `tracks[${trackIndex}]`;

  const rawName = typeof audioMeta.fileName === "string" ? audioMeta.fileName : "";
  const rawFormat = typeof audioMeta.format === "string" ? audioMeta.format : "";
  const extFromName = rawName.includes(".") ? "." + (rawName.split(".").pop()?.toLowerCase() || "") : "";
  const extFromFmt = rawFormat ? "." + rawFormat.replace(/^\./, "").toLowerCase() : "";
  const ext = extFromName || extFromFmt;
  const mimeLower = (audioMeta.mimeType || "").toLowerCase();
  const extAllowed = ext ? ONCE_AUDIO_REQUIREMENTS.acceptedExtensions.includes(ext) : false;
  const mimeAllowed = mimeLower
    ? ONCE_AUDIO_REQUIREMENTS.acceptedMimePrefixes.some((m) => mimeLower.startsWith(m))
    : false;
  if ((ext || mimeLower) && !extAllowed && !mimeAllowed) {
    issues.push({
      field: `${prefix}.audio_file_url`,
      code: "unsupported_audio_format",
      severity: "error",
      message: `Track ${trackIndex + 1} uses an unsupported audio format (${audioMeta.format || ext}). Please upload WAV (recommended), FLAC, MP3, AAC, M4A, OGG, AIFF, or MP4.`,
    });
  }

  if (typeof audioMeta.fileSizeBytes === "number" && audioMeta.fileSizeBytes > ONCE_AUDIO_REQUIREMENTS.maxFileSizeBytes) {
    issues.push({
      field: `${prefix}.audio_file_url`,
      code: "audio_file_too_large",
      severity: "error",
      message: `Track ${trackIndex + 1} exceeds ONCE's 1 GB maximum file size.`,
    });
  }

  if (typeof audioMeta.durationSeconds === "number") {
    if (audioMeta.durationSeconds < ONCE_AUDIO_REQUIREMENTS.minDurationSeconds) {
      issues.push({
        field: `${prefix}.audio_file_url`,
        code: "audio_too_short",
        severity: "error",
        message: `Track ${trackIndex + 1} is too short (${audioMeta.durationSeconds.toFixed(1)}s). Audio tracks must be at least ${ONCE_AUDIO_REQUIREMENTS.minDurationSeconds} seconds long.`,
      });
    } else if (audioMeta.durationSeconds < ONCE_AUDIO_REQUIREMENTS.recommendedMinDurationSeconds) {
      issues.push({
        field: `${prefix}.audio_file_url`,
        code: "audio_short_warning",
        severity: "warning",
        message: `Track ${trackIndex + 1} is under 30 seconds (${audioMeta.durationSeconds.toFixed(0)}s). Some streaming stores prefer tracks of 30 seconds or longer.`,
      });
    }
  }

  if (typeof audioMeta.sampleRateHz === "number" && audioMeta.sampleRateHz < ONCE_AUDIO_REQUIREMENTS.minSampleRateHz) {
    issues.push({
      field: `${prefix}.audio_file_url`,
      code: "sample_rate_too_low",
      severity: "error",
      message: `Track ${trackIndex + 1} sample rate is ${(audioMeta.sampleRateHz / 1000).toFixed(1)} kHz. Stores require at least 44.1 kHz.`,
    });
  }

  if (typeof audioMeta.bitDepth === "number" && audioMeta.bitDepth > 0 && audioMeta.bitDepth < ONCE_AUDIO_REQUIREMENTS.minBitDepth) {
    issues.push({
      field: `${prefix}.audio_file_url`,
      code: "bit_depth_too_low",
      severity: "error",
      message: `Track ${trackIndex + 1} bit depth is ${audioMeta.bitDepth}-bit. Please export at 16-bit or 24-bit audio quality.`,
    });
  }

  return issues;
}

export function validateCoverArtMetadata(
  coverMeta: CoverArtInspection | undefined,
  distributionMode: "once_api" | "manual_k70" = "once_api"
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!coverMeta) return issues;

  const mime = (coverMeta.mimeType || "").toLowerCase();
  const rawCoverName = typeof coverMeta.fileName === "string" ? coverMeta.fileName : "";
  const ext = rawCoverName.includes(".") ? "." + (rawCoverName.split(".").pop()?.toLowerCase() || "") : "";
  if (
    (mime || ext) &&
    !ONCE_COVER_ART_REQUIREMENTS.acceptedMimeTypes.includes(mime) &&
    !ONCE_COVER_ART_REQUIREMENTS.acceptedExtensions.includes(ext)
  ) {
    issues.push({
      field: "release.cover_art_file_url",
      code: "unsupported_cover_format",
      severity: "error",
      message: "Cover art must be a JPG or PNG image file.",
    });
  }

  if (typeof coverMeta.fileSizeBytes === "number" && coverMeta.fileSizeBytes > ONCE_COVER_ART_REQUIREMENTS.maxFileSizeBytes) {
    issues.push({
      field: "release.cover_art_file_url",
      code: "cover_file_too_large",
      severity: "error",
      message: "Cover art file is larger than 50 MB. Please upload a JPG or PNG under 50 MB.",
    });
  }

  if (coverMeta.width !== coverMeta.height) {
    issues.push({
      field: "release.cover_art_file_url",
      code: "cover_not_square",
      severity: "error",
      message: `Cover art must be an exact square (1:1 aspect ratio). Yours is ${coverMeta.width}×${coverMeta.height}px.`,
    });
  }

  const minPx = distributionMode === "once_api" ? ONCE_COVER_ART_REQUIREMENTS.minDimensionPx : 1000;
  if (coverMeta.width < minPx || coverMeta.height < minPx) {
    issues.push({
      field: "release.cover_art_file_url",
      code: "cover_too_small",
      severity: "error",
      message: `Cover art must be at least ${minPx}×${minPx} pixels (3000×3000 recommended). Yours is ${coverMeta.width}×${coverMeta.height}px.`,
    });
  } else if (coverMeta.width < ONCE_COVER_ART_REQUIREMENTS.recommendedDimensionPx) {
    issues.push({
      field: "release.cover_art_file_url",
      code: "cover_below_recommended",
      severity: "warning",
      message: `Your cover art (${coverMeta.width}×${coverMeta.height}px) is accepted, though 3000×3000px is recommended for sharp display across all DSPs.`,
    });
  }

  if (coverMeta.width > ONCE_COVER_ART_REQUIREMENTS.maxDimensionPx || coverMeta.height > ONCE_COVER_ART_REQUIREMENTS.maxDimensionPx) {
    issues.push({
      field: "release.cover_art_file_url",
      code: "cover_too_large",
      severity: "error",
      message: `Cover art dimensions cannot exceed ${ONCE_COVER_ART_REQUIREMENTS.maxDimensionPx}×${ONCE_COVER_ART_REQUIREMENTS.maxDimensionPx} pixels.`,
    });
  }

  return issues;
}

export async function validateReleaseSubmission(params: {
  release?: Partial<OnceReleaseInput>;
  tracks?: Array<Partial<OnceTrackInput>>;
  distributionMode?: "once_api" | "manual_k70";
  token?: string;
}): Promise<ValidationReport> {
  const { release = {}, tracks = [], distributionMode = "once_api", token } = params;
  const [rulesResult, schemaResult] = await Promise.all([
    getOnceMetadataRulesWithCache(),
    getOnceReleaseSchemaWithCache(token),
  ]);

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const missingFields: string[] = [];

  const addError = (field: string, code: string, message: string, markMissing = false) => {
    errors.push({ field, code, message, severity: "error" });
    if (markMissing) missingFields.push(field);
  };
  const addWarning = (field: string, code: string, message: string) => {
    warnings.push({ field, code, message, severity: "warning" });
  };

  // --- 1. Release Primary Artist & Collaborations ---
  const primaryArtist = (release.primary_artist_name || "").trim();
  if (!primaryArtist) {
    addError("release.primary_artist_name", "required_field", "Enter your primary artist or band name.", true);
  } else {
    if (GENERIC_ARTIST_PATTERNS.some((p) => p.test(primaryArtist))) {
      addError(
        "release.primary_artist_name",
        "generic_artist_name",
        `"${primaryArtist}" looks like a generic category or playlist name. Streaming stores require a real artist, duo, or band name.`
      );
    }
    if (FORBIDDEN_SYMBOL_REGEX.test(primaryArtist)) {
      addError(
        "release.primary_artist_name",
        "forbidden_symbols",
        "Primary artist name cannot include emojis, ©, or ™ symbols."
      );
    }
    if (/\b(records|entertainment|llc|ltd|inc\.?)\b/i.test(primaryArtist)) {
      addWarning(
        "release.primary_artist_name",
        "company_as_artist",
        "Artist name looks like a record label or company. Make sure this is an actual performing artist name."
      );
    }
  }

  if (Array.isArray(release.primary_artists) && release.primary_artists.length > 0) {
    if (primaryArtist.toLowerCase() === "various artists" && release.primary_artists.length > 1) {
      addError(
        "release.primary_artists",
        "various_artists_with_named_primaries",
        'When the release artist is "Various Artists", do not add extra release-level primary artists—credit them on their individual tracks instead.'
      );
    }
    if (release.primary_artists.length > 4) {
      addError(
        "release.primary_artists",
        "album_primary_artist_overflow",
        "You can list at most 4 primary artists at the release level. Move extra collaborators to individual track credits or use a Various Artists compilation."
      );
    }
    release.primary_artists.forEach((pa, idx) => {
      if (pa.spotify_artist_url && !isValidSpotifyArtistUrl(pa.spotify_artist_url)) {
        addError(
          `release.primary_artists[${idx}].spotify_artist_url`,
          "invalid_spotify_artist_url",
          `Spotify link for ${pa.name || `artist ${idx + 1}`} must be an artist profile URL (https://open.spotify.com/artist/...), not a track or album link.`
        );
      }
      if (pa.apple_music_artist_url && !isValidAppleMusicArtistUrl(pa.apple_music_artist_url)) {
        addError(
          `release.primary_artists[${idx}].apple_music_artist_url`,
          "invalid_apple_music_artist_url",
          `Apple Music link for ${pa.name || `artist ${idx + 1}`} must be an artist profile URL (https://music.apple.com/<country>/artist/.../<id>).`
        );
      }
    });
  }

  // --- 2. Release Title & Version ---
  const title = (release.title || "").trim();
  const titleVersion = (release.title_version || "").trim();
  if (!title) {
    addError("release.title", "required_field", "Enter your release title.", true);
  } else {
    if (PLACEHOLDER_TITLE_PATTERNS.some((p) => p.test(title))) {
      addError(
        "release.title",
        "placeholder_title",
        `"${title}" looks like a placeholder or filename. Enter the real release title.`
      );
    }
    if (FORBIDDEN_SYMBOL_REGEX.test(title) || FORBIDDEN_SYMBOL_REGEX.test(titleVersion)) {
      addError(
        "release.title",
        "forbidden_symbols",
        "Release title and version cannot contain emojis, ©, or ™ symbols."
      );
    }
    if (/\b(feat\.?|ft\.?|featuring)\b/i.test(title)) {
      addError(
        "release.title",
        "featured_in_title",
        'Remove "feat. / ft." from the release title and enter featured artists in the Featured Artists field instead.'
      );
    }
    if (`${title}${titleVersion ? ` (${titleVersion})` : ""}`.length > 150) {
      addWarning(
        "release.title",
        "title_too_long",
        "Release title plus version is over 150 characters, which some stores may reject or shorten."
      );
    }
  }
  if (/^cover$/i.test(titleVersion)) {
    addError(
      "release.title_version",
      "bare_cover_version",
      'Do not put the bare word "Cover" in the title version. Set track type to "Cover" instead (or use a specific qualifier like "Acoustic Cover").'
    );
  }

  // --- 3. Genre, Language, Dates, Label, Copyright ---
  if (!release.genre || !release.genre.trim()) {
    addError("release.genre", "required_field", "Select a primary genre for your release.", true);
  }

  if (release.label && release.label.trim()) {
    const lbl = release.label.trim();
    if (/^various artists$/i.test(lbl) || /^\d+$/.test(lbl)) {
      addError(
        "release.label",
        "invalid_label",
        'Label name must be a real label or artist imprint—not "Various Artists" or a plain number.'
      );
    }
    if (FORBIDDEN_SYMBOL_REGEX.test(lbl)) {
      addError("release.label", "forbidden_symbols", "Label name cannot contain emojis, ©, or ™ symbols.");
    }
  }

  if (!release.audio_language || !release.audio_language.trim()) {
    addError("release.audio_language", "required_field", "Select the primary audio language.", true);
  }

  const releaseDateStr = (release.release_date || "").trim();
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!releaseDateStr) {
    addError("release.release_date", "required_field", "Choose a target release date.", true);
  } else if (!isValidIsoDate(releaseDateStr)) {
    addError("release.release_date", "invalid_date", "Release date must be a valid calendar date in YYYY-MM-DD format.");
  } else {
    if (releaseDateStr < todayStr) {
      addWarning(
        "release.release_date",
        "past_release_date",
        "Your release date is in the past—stores will push it live as soon as possible. For music released earlier, enter the past date under Original Release Date and set Release Date to today or later."
      );
    }
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (releaseDateStr > oneYearFromNow.toISOString().slice(0, 10)) {
      addWarning(
        "release.release_date",
        "far_future_release_date",
        "Release date is more than a year in the future. Double-check the year before submitting."
      );
    }
  }

  if (release.original_release_date && release.original_release_date.trim()) {
    const orig = release.original_release_date.trim();
    if (!isValidIsoDate(orig)) {
      addError("release.original_release_date", "invalid_date", "Original release date must be a valid YYYY-MM-DD date.");
    } else if (orig >= todayStr) {
      addWarning(
        "release.original_release_date",
        "original_date_not_past",
        "Original release date should be in the past (only used for previously released catalog music)."
      );
    }
  }

  // UPC check (ONCE rules say never submit/reuse custom UPC unless intentionally empty/null)
  if (release.upc && release.upc.trim()) {
    addWarning(
      "release.upc",
      "upc_auto_assigned",
      "ONCE automatically generates a fresh UPC barcode at distribution; custom UPCs are ignored."
    );
  }

  // Copyright checks (modern ONCE clients require release & track C-line & P-line)
  const currentYear = new Date().getFullYear();
  if (!release.cline_owner?.trim()) {
    addError("release.cline_owner", "required_field", "Enter the C-line copyright owner (usually your legal name or label).", true);
  } else if (FORBIDDEN_SYMBOL_REGEX.test(release.cline_owner)) {
    addError("release.cline_owner", "forbidden_symbols", "Copyright owner cannot contain emojis, ©, or ™ symbols.");
  }
  const clineYr = Number(release.cline_year);
  if (!release.cline_year || !/^\d{4}$/.test(String(release.cline_year)) || clineYr < 1900 || clineYr > currentYear + 2) {
    addError("release.cline_year", "invalid_copyright_year", "Enter a valid 4-digit C-line copyright year.", !release.cline_year);
  }

  if (!release.pline_owner?.trim()) {
    addError("release.pline_owner", "required_field", "Enter the P-line master recording owner (usually your legal name or label).", true);
  } else if (FORBIDDEN_SYMBOL_REGEX.test(release.pline_owner)) {
    addError("release.pline_owner", "forbidden_symbols", "P-line owner cannot contain emojis, ©, or ™ symbols.");
  }
  const plineYr = Number(release.pline_year);
  if (!release.pline_year || !/^\d{4}$/.test(String(release.pline_year)) || plineYr < 1900 || plineYr > currentYear + 2) {
    addError("release.pline_year", "invalid_copyright_year", "Enter a valid 4-digit P-line copyright year.", !release.pline_year);
  }

  // Contributors check (Producer, Composer, etc.)
  const releaseContributors = Array.isArray(release.contributors) ? release.contributors : [];
  const hasProducer = releaseContributors.some((c) => c.role?.toLowerCase() === "producer" && c.name?.trim());
  if (!hasProducer) {
    addError("release.contributors", "missing_producer", "Add a Producer credit for this release.", true);
  }
  for (const [cIdx, c] of releaseContributors.entries()) {
    if (!c.name?.trim()) continue;
    if (FORBIDDEN_SYMBOL_REGEX.test(c.name)) {
      addError(`release.contributors[${cIdx}].name`, "forbidden_symbols", "Contributor names cannot contain emojis, ©, or ™ symbols.");
    }
    if (["songwriter", "composer", "lyricist", "writer"].includes((c.role || "").toLowerCase()) && !isFullLegalName(c.name)) {
      addError(
        `release.contributors[${cIdx}].name`,
        "songwriter_requires_legal_name",
        `${c.role} "${c.name}" must be a full legal name (first and last name, at least 2 letters each).`
      );
    }
  }

  // Cover Art check
  if (!release.cover_art_file_url?.trim()) {
    addError("release.cover_art_file_url", "required_field", "Upload square cover art before submitting.", true);
  }
  for (const issue of validateCoverArtMetadata(release.cover_art_metadata, distributionMode)) {
    if (issue.severity === "error") errors.push(issue);
    else warnings.push(issue);
  }

  // Store selection check
  if (Array.isArray(release.distribution_store_ids)) {
    if (release.distribution_store_ids.length === 0) {
      addError(
        "release.distribution_store_ids",
        "empty_store_selection",
        "Select at least one streaming store (or choose All Supported Stores).",
        true
      );
    }
    const langLower = (release.metadata_language || release.audio_language || "").toLowerCase();
    if (UGC_RESTRICTED_LANGUAGES.has(langLower) && release.distribution_store_ids.some((id) => UGC_STORE_IDS.has(id))) {
      addError(
        "release.distribution_store_ids",
        "ugc_not_available_for_region",
        "YouTube Content ID and Facebook Rights Manager are not available for releases in this language/region. Deselect those two UGC stores to continue."
      );
    }
  }

  // --- 4. Tracks Validation ---
  if (!Array.isArray(tracks) || tracks.length === 0) {
    addError("tracks", "required_field", "Add at least one track with audio and songwriter credits.", true);
  } else {
    const releaseType = release.type || (tracks.length === 1 ? "single" : "ep");
    if (releaseType === "single" && tracks.length !== 1) {
      addError("tracks", "single_track_count", "A Single release can only contain 1 track. Switch Release Type to EP or Album for multiple tracks.");
    }

    const seenIsrcs = new Set<string>();
    const trackSignatures = new Set<string>();

    tracks.forEach((track, idx) => {
      const prefix = `tracks[${idx}]`;
      const tTitle = (track.title || "").trim();
      const tVersion = (track.title_version || "").trim();

      if (!tTitle) {
        addError(`${prefix}.title`, "required_field", `Track ${idx + 1}: Enter a track title.`, true);
      } else {
        if (PLACEHOLDER_TITLE_PATTERNS.some((p) => p.test(tTitle))) {
          addError(`${prefix}.title`, "placeholder_title", `Track ${idx + 1}: "${tTitle}" looks like a placeholder or filename.`);
        }
        if (FORBIDDEN_SYMBOL_REGEX.test(tTitle) || FORBIDDEN_SYMBOL_REGEX.test(tVersion)) {
          addError(`${prefix}.title`, "forbidden_symbols", `Track ${idx + 1}: Title cannot contain emojis, ©, or ™ symbols.`);
        }
        if (/\b(feat\.?|ft\.?|featuring)\b/i.test(tTitle)) {
          addError(
            `${prefix}.title`,
            "featured_in_title",
            `Track ${idx + 1}: Remove "feat. / ft." from the track title and list featured artists separately.`
          );
        }
        if (`${tTitle}${tVersion ? ` (${tVersion})` : ""}`.length > 150) {
          addWarning(`${prefix}.title`, "title_too_long", `Track ${idx + 1}: Title plus version exceeds 150 characters.`);
        }
      }

      if (releaseType === "single" && idx === 0 && title && tTitle && tTitle !== title) {
        addError(
          `${prefix}.title`,
          "single_title_mismatch",
          "For a Single, the track title must match the release title exactly."
        );
      }

      if (/^cover$/i.test(tVersion)) {
        addError(
          `${prefix}.title_version`,
          "bare_cover_version",
          `Track ${idx + 1}: Do not put "Cover" in the title version. Choose track type "Cover" instead.`
        );
      }

      if (track.track_type && !["original", "cover", "public_domain"].includes(track.track_type)) {
        addError(
          `${prefix}.track_type`,
          "invalid_track_type",
          `Track ${idx + 1}: Track type must be Original, Cover, or Public Domain (put "Remix" in Title Version instead).`
        );
      }

      if (!track.audio_file_url?.trim() || track.audio_file_url.startsWith("blob:")) {
        addError(`${prefix}.audio_file_url`, "required_field", `Track ${idx + 1}: Upload and verify the audio file before submitting.`, true);
      }

      for (const issue of validateAudioMetadata(track.audio_metadata, idx)) {
        if (issue.severity === "error") errors.push(issue);
        else warnings.push(issue);
      }

      if (typeof track.explicit_flag !== "boolean") {
        addError(`${prefix}.explicit_flag`, "required_field", `Track ${idx + 1}: Choose whether this track has explicit lyrics or is clean.`, true);
      }

      if (track.lyrics && FORBIDDEN_SYMBOL_REGEX.test(track.lyrics)) {
        addError(`${prefix}.lyrics`, "forbidden_symbols", `Track ${idx + 1}: Lyrics cannot contain emojis, ©, or ™ symbols.`);
      }

      if (track.isrc && track.isrc.trim()) {
        const cleanIsrc = track.isrc.replace(/[-\s]/g, "").toUpperCase();
        if (!isValidIsrc(cleanIsrc)) {
          addError(`${prefix}.isrc`, "invalid_isrc", `Track ${idx + 1}: ISRC "${track.isrc}" must follow format CC-XXX-YY-NNNNN (12 characters), or leave blank for auto-assignment.`);
        } else if (seenIsrcs.has(cleanIsrc)) {
          addError(`${prefix}.isrc`, "duplicate_isrc", `Track ${idx + 1}: Two tracks on the same release cannot share ISRC ${cleanIsrc}.`);
        } else {
          seenIsrcs.add(cleanIsrc);
        }
      }

      // Writers validation (REQUIRED by ONCE MVP & legal-name rule)
      const writers = Array.isArray(track.writers) ? track.writers.filter((w) => w?.name?.trim()) : [];
      if (writers.length === 0) {
        addError(`${prefix}.writers`, "required_field", `Track ${idx + 1}: Add at least one songwriter with their full legal name (first and last name).`, true);
      } else {
        writers.forEach((w, wIdx) => {
          if (FORBIDDEN_SYMBOL_REGEX.test(w.name)) {
            addError(`${prefix}.writers[${wIdx}].name`, "forbidden_symbols", `Track ${idx + 1}: Songwriter name cannot contain emojis, ©, or ™.`);
          } else if (!isFullLegalName(w.name)) {
            addError(
              `${prefix}.writers[${wIdx}].name`,
              "writer_full_legal_name_required",
              `Track ${idx + 1}: Songwriter "${w.name}" must include a full legal name (first and last name, at least 2 letters per name—no initials).`
            );
          }
        });
      }

      // Track-level copyright & contributors
      const tWriters = track.contributors || [];
      tWriters.forEach((c, cIdx) => {
        if (!c.name?.trim()) return;
        if (["songwriter", "composer", "lyricist", "writer"].includes((c.role || "").toLowerCase()) && !isFullLegalName(c.name)) {
          addError(
            `${prefix}.contributors[${cIdx}].name`,
            "contributor_legal_name_required",
            `Track ${idx + 1}: ${c.role} "${c.name}" must be a full legal name (first and last name).`
          );
        }
      });

      const sig = `${tTitle.toLowerCase()}|${tVersion.toLowerCase()}|${(track.primary_artist_name || primaryArtist).toLowerCase()}|${String(track.explicit_flag)}`;
      if (tTitle && trackSignatures.has(sig)) {
        addError(
          `${prefix}.title`,
          "duplicate_track_signature",
          `Track ${idx + 1}: Two tracks cannot have the exact same title, version, artist, and explicit status.`
        );
      } else if (tTitle) {
        trackSignatures.add(sig);
      }
    });
  }

  return {
    valid: errors.length === 0,
    submittable: errors.length === 0,
    errors,
    warnings,
    missingFields: Array.from(new Set(missingFields)),
    schemaSource: schemaResult.source,
    rulesSource: rulesResult.source,
    checkedAt: new Date().toISOString(),
  };
}
