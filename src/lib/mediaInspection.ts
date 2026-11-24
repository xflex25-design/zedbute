import { CLIENT_AUDIO_SPECS, CLIENT_COVER_SPECS } from "./onceCatalog";
import type { AudioFileInspection, CoverArtInspection } from "../../server/once/types";

export interface MediaCheckResult<T> {
  valid: boolean;
  metadata?: T;
  errors: string[];
  warnings: string[];
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(view.getUint8(offset + i));
  }
  return out;
}

/**
 * Inspects WAV / FLAC headers cleanly for exact sample rate and bit depth
 * without loading entire large audio files into memory.
 */
async function parseBinaryAudioHeader(file: File): Promise<{
  sampleRateHz?: number;
  bitDepth?: number;
  channels?: number;
  durationSeconds?: number;
}> {
  const slice = await file.slice(0, 128 * 1024).arrayBuffer();
  const view = new DataView(slice);
  if (view.byteLength < 16) return {};

  const magic = readAscii(view, 0, 4);

  // RIFF WAVE
  if (magic === "RIFF" && readAscii(view, 8, 4) === "WAVE") {
    let offset = 12;
    let sampleRateHz: number | undefined;
    let bitDepth: number | undefined;
    let channels: number | undefined;
    let byteRate: number | undefined;
    let dataSize: number | undefined;

    while (offset + 8 <= view.byteLength) {
      const chunkId = readAscii(view, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === "fmt " && offset + 24 <= view.byteLength) {
        channels = view.getUint16(offset + 10, true);
        sampleRateHz = view.getUint32(offset + 12, true);
        byteRate = view.getUint32(offset + 16, true);
        bitDepth = view.getUint16(offset + 22, true);
      } else if (chunkId === "data") {
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }

    const durationSeconds =
      byteRate && dataSize ? dataSize / byteRate : undefined;
    return { sampleRateHz, bitDepth, channels, durationSeconds };
  }

  // FLAC STREAMINFO
  if (magic === "fLaC" && view.byteLength >= 42) {
    // Metadata block header at byte 4 (4 bytes); STREAMINFO payload starts at byte 8
    // Bytes 18..25 contain sample rate (20 bits), channels-1 (3 bits), bps-1 (5 bits), total samples (36 bits)
    const b10 = view.getUint8(18);
    const b11 = view.getUint8(19);
    const b12 = view.getUint8(20);
    const b13 = view.getUint8(21);
    const sampleRateHz = (b10 << 12) | (b11 << 4) | (b12 >> 4);
    const channels = ((b12 >> 1) & 0x07) + 1;
    const bitDepth = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;
    const totalSamplesHi = b13 & 0x0f;
    const totalSamplesLo = view.getUint32(22, false);
    const totalSamples = totalSamplesHi * 2 ** 32 + totalSamplesLo;
    const durationSeconds =
      sampleRateHz > 0 && totalSamples > 0 ? totalSamples / sampleRateHz : undefined;
    return { sampleRateHz, bitDepth, channels, durationSeconds };
  }

  return {};
}

async function readBrowserAudioElementInfo(file: File): Promise<{
  durationSeconds?: number;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve({});
    }, 6000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const duration = Number.isFinite(audio.duration) ? audio.duration : undefined;
      cleanup();
      resolve({ durationSeconds: duration });
    };

    audio.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      resolve({});
    };

    audio.src = url;
  });
}

export async function inspectAndValidateAudioFile(file: File): Promise<MediaCheckResult<AudioFileInspection>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  const format = ext.replace(".", "").toUpperCase() || "UNKNOWN";
  const mime = (file.type || "").toLowerCase();

  const extOk = CLIENT_AUDIO_SPECS.acceptedExtensions.includes(ext);
  const mimeOk = mime.startsWith("audio/") || mime === "video/mp4";

  if (!extOk && !mimeOk) {
    errors.push(
      `Unsupported audio format "${format}". Please upload ${CLIENT_AUDIO_SPECS.acceptedFormatsLabel}.`
    );
  }

  if (file.size === 0) {
    errors.push("The selected audio file appears to be empty.");
  } else if (file.size > CLIENT_AUDIO_SPECS.maxFileSizeBytes) {
    errors.push(
      `Audio file is ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB. Maximum allowed size is 1 GB per file.`
    );
  }

  const [headerInfo, mediaInfo] = await Promise.all([
    parseBinaryAudioHeader(file).catch(() => ({})),
    readBrowserAudioElementInfo(file).catch(() => ({})),
  ]);

  const durationSeconds = headerInfo.durationSeconds || mediaInfo.durationSeconds;
  const sampleRateHz = headerInfo.sampleRateHz;
  const bitDepth = headerInfo.bitDepth;
  const channels = headerInfo.channels;

  if (typeof durationSeconds === "number") {
    if (durationSeconds < CLIENT_AUDIO_SPECS.minDurationSeconds) {
      errors.push(
        `Track duration is ${durationSeconds.toFixed(1)}s. Audio tracks must be at least ${CLIENT_AUDIO_SPECS.minDurationSeconds} seconds long.`
      );
    } else if (durationSeconds < CLIENT_AUDIO_SPECS.recommendedMinDurationSeconds) {
      warnings.push(
        `Track is under 30 seconds (${Math.round(durationSeconds)}s). Some DSPs may treat very short tracks as clips.`
      );
    }
  }

  if (typeof sampleRateHz === "number" && sampleRateHz < CLIENT_AUDIO_SPECS.minSampleRateHz) {
    errors.push(
      `Audio sample rate is ${(sampleRateHz / 1000).toFixed(1)} kHz. Export at 44.1 kHz or higher (e.g. 44.1 kHz / 48 kHz).`
    );
  }

  if (typeof bitDepth === "number" && bitDepth > 0 && bitDepth < CLIENT_AUDIO_SPECS.minBitDepth) {
    errors.push(
      `Audio bit depth is ${bitDepth}-bit. Streaming stores require 16-bit or 24-bit audio.`
    );
  }

  if (format === "MP3") {
    warnings.push("MP3 is accepted, though lossless WAV (16-bit or 24-bit, 44.1 kHz+) is recommended for best store quality.");
  }

  const metadata: AudioFileInspection = {
    fileName: file.name,
    mimeType: file.type || `audio/${ext.replace(".", "")}`,
    fileSizeBytes: file.size,
    format,
    durationSeconds,
    sampleRateHz,
    bitDepth,
    channels,
  };

  return {
    valid: errors.length === 0,
    metadata,
    errors,
    warnings,
  };
}

export async function inspectAndValidateCoverArt(
  file: File,
  distributionMode: "once_api" | "manual_k70" = "once_api"
): Promise<MediaCheckResult<CoverArtInspection>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
  const mime = (file.type || "").toLowerCase();

  if (!CLIENT_COVER_SPECS.acceptedMimeTypes.includes(mime) && ![".jpg", ".jpeg", ".png"].includes(ext)) {
    errors.push("Cover art must be a JPG or PNG image file.");
  }

  if (file.size === 0) {
    errors.push("Selected cover art file is empty.");
  } else if (file.size > CLIENT_COVER_SPECS.maxFileSizeBytes) {
    errors.push(
      `Cover art file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed size is 50 MB.`
    );
  }

  const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

  if (!dims) {
    errors.push("Could not read this image file. Try exporting a fresh JPG or PNG copy.");
    return { valid: false, errors, warnings };
  }

  if (dims.width !== dims.height) {
    errors.push(
      `Cover art must be an exact square (1:1 aspect ratio). This image is ${dims.width}×${dims.height} px.`
    );
  }

  const minPx = distributionMode === "once_api" ? CLIENT_COVER_SPECS.minDimensionPx : 1000;
  if (dims.width < minPx || dims.height < minPx) {
    errors.push(
      `Cover art must be at least ${minPx}×${minPx} pixels (${CLIENT_COVER_SPECS.recommendedDimensionPx}×${CLIENT_COVER_SPECS.recommendedDimensionPx} recommended). Yours is ${dims.width}×${dims.height} px.`
    );
  } else if (dims.width < CLIENT_COVER_SPECS.recommendedDimensionPx) {
    warnings.push(
      `Your artwork (${dims.width}×${dims.height} px) works, though ${CLIENT_COVER_SPECS.recommendedDimensionPx}×${CLIENT_COVER_SPECS.recommendedDimensionPx} px is recommended by streaming platforms.`
    );
  }

  if (dims.width > CLIENT_COVER_SPECS.maxDimensionPx || dims.height > CLIENT_COVER_SPECS.maxDimensionPx) {
    errors.push(
      `Cover art dimensions exceed ${CLIENT_COVER_SPECS.maxDimensionPx}×${CLIENT_COVER_SPECS.maxDimensionPx} px.`
    );
  }

  const metadata: CoverArtInspection = {
    fileName: file.name,
    mimeType: file.type || (ext === ".png" ? "image/png" : "image/jpeg"),
    fileSizeBytes: file.size,
    width: dims.width,
    height: dims.height,
    aspectRatio: dims.height > 0 ? Number((dims.width / dims.height).toFixed(2)) : undefined,
  };

  return {
    valid: errors.length === 0,
    metadata,
    errors,
    warnings,
  };
}

export function formatDurationMmSs(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "Unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
