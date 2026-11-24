import type { FieldValidationIssue } from "@/components/upload/FieldValidationMessage";
import type { AudioFileInspection, CoverArtInspection } from "../../server/once/types";

export interface WizardFormFieldsForValidation {
  primaryArtistName: string;
  featuredArtistsText: string;
  spotifyArtistUrl: string;
  appleMusicArtistUrl: string;
  composerName: string;
  defaultSongwriterName: string;
  producerName: string;
  labelName: string;
  title: string;
  titleVersion: string;
  releaseType: "single" | "ep" | "album";
  genre: string;
  subGenre: string;
  languageCode: string;
  description: string;
  releaseDate: string;
  hasOriginalReleaseDate: boolean;
  originalReleaseDate: string;
  clineOwner: string;
  clineYear: string;
  plineOwner: string;
  plineYear: string;
  coverArtFileUrl: string;
  coverArtMetadata?: CoverArtInspection;
  distributionStoreIds: number[];
  distributionMode: "once_api" | "manual_k70";
  rightsConfirmed: boolean;
  submissionConfirmed: boolean;
}

export interface WizardTrackFieldsForValidation {
  id: string;
  title: string;
  titleVersion: string;
  trackType: "original" | "cover" | "public_domain";
  explicitFlag: boolean;
  songwriterName: string;
  extraWritersText: string;
  isrc: string;
  lyrics: string;
  audioFileUrl: string;
  audioMetadata?: AudioFileInspection;
  uploadError?: string;
}

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
const FORBIDDEN_SYMBOL_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}©™]/u;
const CJK_KANA_HANGUL_REGEX = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

export function isFullLegalName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (CJK_KANA_HANGUL_REGEX.test(trimmed)) {
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

function extractLiveGenericArtistExamples(markdown?: string): string[] {
  if (!markdown) return [];
  const line = markdown
    .split(/\r?\n/)
    .find((l) => /generic|search-term|various/i.test(l) && /ASMR|Lofi|Yoga|Binaural/i.test(l));
  if (!line) return [];
  const quoted = Array.from(line.matchAll(/`([^`]+)`|"([^"]+)"/g))
    .map((m) => (m[1] || m[2] || "").trim().toLowerCase())
    .filter((s) => s.length >= 3 && s.length <= 48);
  return quoted;
}

export interface WizardFieldValidationResult {
  fields: Record<string, FieldValidationIssue[]>;
  stepErrors: Record<number, number>;
  stepFirstErrors: Record<number, FieldValidationIssue | undefined>;
  hasErrorsOnStep: (step: number) => boolean;
}

export function validateWizardFields(
  form: WizardFormFieldsForValidation,
  tracks: WizardTrackFieldsForValidation[],
  options?: { rulesMarkdown?: string; isEditMode?: boolean }
): WizardFieldValidationResult {
  const fields: Record<string, FieldValidationIssue[]> = {};
  const stepErrors: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const stepFirstErrors: Record<number, FieldValidationIssue | undefined> = {};

  const pushIssue = (
    key: string,
    step: number,
    severity: "error" | "warning",
    code: string,
    message: string
  ) => {
    const issue: FieldValidationIssue = { severity, code, message };
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue);
    if (severity === "error") {
      stepErrors[step] = (stepErrors[step] || 0) + 1;
      if (!stepFirstErrors[step]) {
        stepFirstErrors[step] = issue;
      }
    }
  };

  const extraGenericNames = extractLiveGenericArtistExamples(options?.rulesMarkdown);

  // =========================================================
  // STEP 1: ARTIST INFORMATION & CREDITS
  // =========================================================
  const primaryArtist = form.primaryArtistName.trim();
  if (!primaryArtist) {
    pushIssue(
      "primaryArtistName",
      1,
      "error",
      "required_field",
      "Enter your primary artist, duo, or band name."
    );
  } else {
    const lowerArtist = primaryArtist.toLowerCase();
    if (
      GENERIC_ARTIST_PATTERNS.some((p) => p.test(primaryArtist)) ||
      extraGenericNames.includes(lowerArtist)
    ) {
      pushIssue(
        "primaryArtistName",
        1,
        "error",
        "generic_artist_name",
        `"${primaryArtist}" looks like a generic mood or category name. ONCE requires a real performing artist, duo, or band name.`
      );
    }
    if (FORBIDDEN_SYMBOL_REGEX.test(primaryArtist)) {
      pushIssue(
        "primaryArtistName",
        1,
        "error",
        "forbidden_symbols",
        "Primary artist name cannot include emojis, ©, or ™ symbols."
      );
    }
    if (/\b(feat\.?|ft\.?|featuring)\b/i.test(primaryArtist)) {
      pushIssue(
        "primaryArtistName",
        1,
        "error",
        "featured_in_primary_artist",
        'Do not put "feat. / ft." in Primary Artist Name. List guests under Featured Artists below.'
      );
    }
    if (/\b(records|entertainment|llc|ltd|inc\.?)\b/i.test(primaryArtist)) {
      pushIssue(
        "primaryArtistName",
        1,
        "warning",
        "company_as_artist",
        "This looks like a record label or company name—make sure it is an actual performing artist name."
      );
    }
  }

  const featuredRaw = form.featuredArtistsText.trim();
  if (featuredRaw) {
    if (FORBIDDEN_SYMBOL_REGEX.test(featuredRaw)) {
      pushIssue(
        "featuredArtistsText",
        1,
        "error",
        "forbidden_symbols",
        "Featured artist names cannot include emojis, ©, or ™ symbols."
      );
    } else if (/^\s*(feat\.?|ft\.?|featuring)\b/i.test(featuredRaw)) {
      pushIssue(
        "featuredArtistsText",
        1,
        "error",
        "featured_prefix_not_needed",
        'Enter only the featured artist names separated by commas (do not type "feat." or "ft.").'
      );
    } else if (
      primaryArtist &&
      featuredRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(primaryArtist.toLowerCase())
    ) {
      pushIssue(
        "featuredArtistsText",
        1,
        "warning",
        "primary_listed_as_featured",
        "Primary artist is also listed as a featured artist—remove duplicates if not needed."
      );
    }
  }

  const songwriter = form.defaultSongwriterName.trim();
  if (!songwriter) {
    pushIssue(
      "defaultSongwriterName",
      1,
      "error",
      "required_field",
      "Enter the songwriter's full legal name (first and last name)."
    );
  } else if (FORBIDDEN_SYMBOL_REGEX.test(songwriter)) {
    pushIssue(
      "defaultSongwriterName",
      1,
      "error",
      "forbidden_symbols",
      "Songwriter name cannot include emojis, ©, or ™ symbols."
    );
  } else if (!isFullLegalName(songwriter)) {
    pushIssue(
      "defaultSongwriterName",
      1,
      "error",
      "writer_full_legal_name_required",
      `Songwriter "${songwriter}" must include a full legal name (first and last name, at least 2 letters each—no initials or single word).`
    );
  }

  const composer = form.composerName.trim();
  if (!composer) {
    pushIssue(
      "composerName",
      1,
      "error",
      "required_field",
      "Enter the composer's full legal name (first and last name)."
    );
  } else if (FORBIDDEN_SYMBOL_REGEX.test(composer)) {
    pushIssue(
      "composerName",
      1,
      "error",
      "forbidden_symbols",
      "Composer name cannot include emojis, ©, or ™ symbols."
    );
  } else if (!isFullLegalName(composer)) {
    pushIssue(
      "composerName",
      1,
      "error",
      "composer_full_legal_name_required",
      `Composer "${composer}" must include a full legal name (first and last name, at least 2 letters each).`
    );
  }

  const producer = form.producerName.trim();
  if (!producer) {
    pushIssue(
      "producerName",
      1,
      "error",
      "required_field",
      "Enter a Producer credit for this release (stage names or aliases are allowed)."
    );
  } else if (FORBIDDEN_SYMBOL_REGEX.test(producer)) {
    pushIssue(
      "producerName",
      1,
      "error",
      "forbidden_symbols",
      "Producer name cannot include emojis, ©, or ™ symbols."
    );
  }

  const label = form.labelName.trim();
  if (label) {
    if (/^various artists$/i.test(label) || /^\d+$/.test(label)) {
      pushIssue(
        "labelName",
        1,
        "error",
        "invalid_label",
        'Label name must be a real label or artist imprint—not "Various Artists" or a plain number.'
      );
    } else if (FORBIDDEN_SYMBOL_REGEX.test(label)) {
      pushIssue(
        "labelName",
        1,
        "error",
        "forbidden_symbols",
        "Label name cannot include emojis, ©, or ™ symbols."
      );
    }
  }

  if (form.spotifyArtistUrl.trim() && !isValidSpotifyArtistUrl(form.spotifyArtistUrl)) {
    pushIssue(
      "spotifyArtistUrl",
      1,
      "error",
      "invalid_spotify_artist_url",
      "Must be a valid Spotify artist profile URL (e.g. https://open.spotify.com/artist/...), not a track or album link."
    );
  }

  if (form.appleMusicArtistUrl.trim() && !isValidAppleMusicArtistUrl(form.appleMusicArtistUrl)) {
    pushIssue(
      "appleMusicArtistUrl",
      1,
      "error",
      "invalid_apple_music_artist_url",
      "Must be a valid Apple Music artist URL (e.g. https://music.apple.com/us/artist/name/123456)."
    );
  }

  // =========================================================
  // STEP 2: RELEASE INFORMATION, TRACKS & COPYRIGHT
  // =========================================================
  const title = form.title.trim();
  const titleVersion = form.titleVersion.trim();
  if (!title) {
    pushIssue("title", 2, "error", "required_field", "Enter your release title.");
  } else {
    if (PLACEHOLDER_TITLE_PATTERNS.some((p) => p.test(title))) {
      pushIssue(
        "title",
        2,
        "error",
        "placeholder_title",
        `"${title}" looks like a placeholder or filename. Enter the real release title.`
      );
    }
    if (FORBIDDEN_SYMBOL_REGEX.test(title)) {
      pushIssue(
        "title",
        2,
        "error",
        "forbidden_symbols",
        "Release title cannot contain emojis, ©, or ™ symbols."
      );
    }
    if (/\b(feat\.?|ft\.?|featuring)\b/i.test(title)) {
      pushIssue(
        "title",
        2,
        "error",
        "featured_in_title",
        'Remove "feat. / ft." from the release title and enter featured artists in Step 1 instead.'
      );
    }
    if (`${title}${titleVersion ? ` (${titleVersion})` : ""}`.length > 150) {
      pushIssue(
        "title",
        2,
        "warning",
        "title_too_long",
        "Release title plus version is over 150 characters, which some stores may shorten."
      );
    }
  }

  if (titleVersion) {
    if (/^cover$/i.test(titleVersion)) {
      pushIssue(
        "titleVersion",
        2,
        "error",
        "bare_cover_version",
        'Do not put the bare word "Cover" here. Choose "Cover Song" under Recording Origin instead (or use a qualifier like "Acoustic Cover").'
      );
    } else if (FORBIDDEN_SYMBOL_REGEX.test(titleVersion)) {
      pushIssue(
        "titleVersion",
        2,
        "error",
        "forbidden_symbols",
        "Title version cannot contain emojis, ©, or ™ symbols."
      );
    }
  }

  if (!form.genre.trim()) {
    pushIssue("genre", 2, "error", "required_field", "Select a primary genre for your release.");
  }

  if (!form.languageCode.trim()) {
    pushIssue("languageCode", 2, "error", "required_field", "Select the primary audio language.");
  } else if (
    UGC_RESTRICTED_LANGUAGES.has(form.languageCode.toLowerCase()) &&
    form.distributionStoreIds.some((id) => UGC_STORE_IDS.has(id))
  ) {
    pushIssue(
      "languageCode",
      2,
      "warning",
      "ugc_language_notice",
      "Selected language cannot be delivered to YouTube Content ID or Facebook Rights Manager—you can deselect those two stores in Step 4."
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const relDate = form.releaseDate.trim();
  if (!relDate) {
    pushIssue("releaseDate", 2, "error", "required_field", "Choose a target release date.");
  } else if (!isValidIsoDate(relDate)) {
    pushIssue("releaseDate", 2, "error", "invalid_date", "Release date must be a valid YYYY-MM-DD calendar date.");
  } else {
    if (relDate < todayStr) {
      pushIssue(
        "releaseDate",
        2,
        "warning",
        "past_release_date",
        "This date is in the past—stores will push live immediately. For catalog music released earlier, toggle Previously Released and set today or a future date here."
      );
    }
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    if (relDate > oneYearOut.toISOString().slice(0, 10)) {
      pushIssue(
        "releaseDate",
        2,
        "warning",
        "far_future_release_date",
        "Release date is more than a year in the future. Double-check the year."
      );
    }
  }

  if (form.hasOriginalReleaseDate) {
    const orig = form.originalReleaseDate.trim();
    if (!orig) {
      pushIssue(
        "originalReleaseDate",
        2,
        "error",
        "required_field",
        "Enter the original release date, or turn off Previously Released."
      );
    } else if (!isValidIsoDate(orig)) {
      pushIssue(
        "originalReleaseDate",
        2,
        "error",
        "invalid_date",
        "Original release date must be a valid YYYY-MM-DD date."
      );
    } else if (orig >= todayStr) {
      pushIssue(
        "originalReleaseDate",
        2,
        "warning",
        "original_date_not_past",
        "Original release date should be in the past."
      );
    }
  }

  if (form.description && FORBIDDEN_SYMBOL_REGEX.test(form.description)) {
    pushIssue(
      "description",
      2,
      "error",
      "forbidden_symbols",
      "Release description cannot include emojis, ©, or ™ symbols."
    );
  }

  // Track-level Step 2 checks
  if (form.releaseType === "ep" && (tracks.length < 4 || tracks.length > 6)) {
    pushIssue(
      "tracklist",
      2,
      "warning",
      "ep_track_count",
      `EPs typically contain 4–6 tracks (currently ${tracks.length}).`
    );
  } else if (form.releaseType === "album" && tracks.length < 7) {
    pushIssue(
      "tracklist",
      2,
      "warning",
      "album_track_count",
      `Albums typically contain 7 or more tracks (currently ${tracks.length}).`
    );
  }

  const seenIsrcs = new Map<string, number>();
  const trackSignatures = new Map<string, number>();

  tracks.forEach((tr, idx) => {
    const tTitle = (form.releaseType === "single" && idx === 0 ? form.title : tr.title).trim();
    const tKey = `tracks.${idx}.title`;

    if (form.releaseType !== "single" || idx > 0) {
      if (!tTitle) {
        pushIssue(tKey, 2, "error", "required_field", `Track ${idx + 1}: Enter a track title.`);
      } else {
        if (PLACEHOLDER_TITLE_PATTERNS.some((p) => p.test(tTitle))) {
          pushIssue(
            tKey,
            2,
            "error",
            "placeholder_title",
            `Track ${idx + 1}: "${tTitle}" looks like a placeholder or filename.`
          );
        }
        if (FORBIDDEN_SYMBOL_REGEX.test(tTitle)) {
          pushIssue(
            tKey,
            2,
            "error",
            "forbidden_symbols",
            `Track ${idx + 1}: Title cannot contain emojis, ©, or ™ symbols.`
          );
        }
        if (/\b(feat\.?|ft\.?|featuring)\b/i.test(tTitle)) {
          pushIssue(
            tKey,
            2,
            "error",
            "featured_in_title",
            `Track ${idx + 1}: Remove "feat. / ft." from the title and enter featured artists in Step 1.`
          );
        }
      }
    }

    if (tTitle) {
      const sig = `${tTitle.toLowerCase()}|${(tr.titleVersion || "").trim().toLowerCase()}|${primaryArtist.toLowerCase()}|${String(tr.explicitFlag)}`;
      const existingIdx = trackSignatures.get(sig);
      if (existingIdx !== undefined) {
        pushIssue(
          tKey,
          2,
          "error",
          "duplicate_track_signature",
          `Track ${idx + 1}: Matches Track ${existingIdx + 1} (title, explicit status). Use unique track titles or versions.`
        );
      } else {
        trackSignatures.set(sig, idx);
      }
    }

    if (tr.isrc.trim()) {
      const cleanIsrc = tr.isrc.replace(/[-\s]/g, "").toUpperCase();
      if (!isValidIsrc(cleanIsrc)) {
        pushIssue(
          `tracks.${idx}.isrc`,
          2,
          "error",
          "invalid_isrc",
          `ISRC "${tr.isrc}" must match CC-XXX-YY-NNNNN (12 characters), or leave blank for ONCE to assign one.`
        );
      } else {
        const dupIdx = seenIsrcs.get(cleanIsrc);
        if (dupIdx !== undefined) {
          pushIssue(
            `tracks.${idx}.isrc`,
            2,
            "error",
            "duplicate_isrc",
            `Duplicate ISRC with Track ${dupIdx + 1}. Each track needs a unique ISRC.`
          );
        } else {
          seenIsrcs.set(cleanIsrc, idx);
        }
      }
    }
  });

  // Copyright lines
  const currentYear = new Date().getFullYear();
  if (!form.clineOwner.trim()) {
    pushIssue(
      "clineOwner",
      2,
      "error",
      "required_field",
      "Enter the C-line copyright owner (usually your legal name or record label)."
    );
  } else if (FORBIDDEN_SYMBOL_REGEX.test(form.clineOwner)) {
    pushIssue(
      "clineOwner",
      2,
      "error",
      "forbidden_symbols",
      "C-line owner cannot contain emojis, ©, or ™ symbols."
    );
  }

  const clineYr = Number(form.clineYear);
  if (!form.clineYear.trim()) {
    pushIssue("clineYear", 2, "error", "required_field", "Enter a 4-digit C-line year.");
  } else if (!/^\d{4}$/.test(form.clineYear.trim()) || clineYr < 1900 || clineYr > currentYear + 2) {
    pushIssue("clineYear", 2, "error", "invalid_copyright_year", `Enter a valid 4-digit year (1900–${currentYear + 2}).`);
  }

  if (!form.plineOwner.trim()) {
    pushIssue(
      "plineOwner",
      2,
      "error",
      "required_field",
      "Enter the P-line master recording owner (usually your legal name or label)."
    );
  } else if (FORBIDDEN_SYMBOL_REGEX.test(form.plineOwner)) {
    pushIssue(
      "plineOwner",
      2,
      "error",
      "forbidden_symbols",
      "P-line owner cannot contain emojis, ©, or ™ symbols."
    );
  }

  const plineYr = Number(form.plineYear);
  if (!form.plineYear.trim()) {
    pushIssue("plineYear", 2, "error", "required_field", "Enter a 4-digit P-line year.");
  } else if (!/^\d{4}$/.test(form.plineYear.trim()) || plineYr < 1900 || plineYr > currentYear + 2) {
    pushIssue("plineYear", 2, "error", "invalid_copyright_year", `Enter a valid 4-digit year (1900–${currentYear + 2}).`);
  }

  // =========================================================
  // STEP 3: MEDIA UPLOADS & SPECS
  // =========================================================
  if (!form.coverArtFileUrl.trim()) {
    pushIssue(
      "coverArtFileUrl",
      3,
      "error",
      "required_field",
      "Upload square cover art (JPG or PNG, minimum 1400×1400px, 3000×3000px recommended)."
    );
  } else if (form.coverArtMetadata && form.coverArtMetadata.width < 3000) {
    pushIssue(
      "coverArtFileUrl",
      3,
      "warning",
      "cover_below_recommended",
      `Artwork is ${form.coverArtMetadata.width}×${form.coverArtMetadata.height}px (accepted, though 3000×3000px is recommended for sharp display across DSPs).`
    );
  }

  tracks.forEach((tr, idx) => {
    const aKey = `tracks.${idx}.audioFileUrl`;
    if (tr.uploadError) {
      pushIssue(aKey, 3, "error", "audio_upload_failed", tr.uploadError);
    } else if (!tr.audioFileUrl.trim() || tr.audioFileUrl.startsWith("blob:")) {
      pushIssue(
        aKey,
        3,
        "error",
        "required_field",
        `Track ${idx + 1}: Upload and verify the master audio file (WAV 16/24-bit, 44.1 kHz+ recommended).`
      );
    } else if (
      tr.audioMetadata &&
      typeof tr.audioMetadata.durationSeconds === "number" &&
      tr.audioMetadata.durationSeconds < 30
    ) {
      pushIssue(
        aKey,
        3,
        "warning",
        "audio_short_warning",
        `Track ${idx + 1} is ${tr.audioMetadata.durationSeconds.toFixed(0)}s long. Some stores prefer 30 seconds or longer.`
      );
    }
  });

  // =========================================================
  // STEP 4: DISTRIBUTION STORES & SCHEDULE
  // =========================================================
  if (!Array.isArray(form.distributionStoreIds) || form.distributionStoreIds.length === 0) {
    pushIssue(
      "distributionStoreIds",
      4,
      "error",
      "empty_store_selection",
      "Select at least one streaming store before continuing."
    );
  } else if (
    UGC_RESTRICTED_LANGUAGES.has(form.languageCode.toLowerCase()) &&
    form.distributionStoreIds.some((id) => UGC_STORE_IDS.has(id))
  ) {
    pushIssue(
      "distributionStoreIds",
      4,
      "error",
      "ugc_not_available_for_region",
      "YouTube Content ID and Facebook Rights Manager are not supported for the selected language. Deselect those two stores to proceed."
    );
  }

  if (fields.releaseDate) {
    for (const issue of fields.releaseDate) {
      pushIssue("step4ReleaseDate", 4, issue.severity, issue.code, issue.message);
    }
  }

  // =========================================================
  // STEP 5: CONFIRMATION CHECKBOXES
  // =========================================================
  if (!form.rightsConfirmed) {
    pushIssue(
      "rightsConfirmed",
      5,
      "error",
      "required_field",
      "Confirm you own or control distribution rights before submitting."
    );
  }
  if (!options?.isEditMode && !form.submissionConfirmed) {
    pushIssue(
      "submissionConfirmed",
      5,
      "error",
      "required_field",
      "Check the final confirmation box to submit your release."
    );
  }

  return {
    fields,
    stepErrors,
    stepFirstErrors,
    hasErrorsOnStep: (step: number) => (stepErrors[step] || 0) > 0,
  };
}

export function getVisibleFieldIssue(
  validation: WizardFieldValidationResult,
  fieldKey: string,
  touched: Record<string, boolean>,
  stepAttempted: Record<number, boolean>,
  stepNumber: number
): FieldValidationIssue | null {
  const issues = validation.fields[fieldKey];
  if (!issues || issues.length === 0) return null;

  const isTouchedOrAttempted = Boolean(touched[fieldKey] || stepAttempted[stepNumber]);

  // Always show non-empty format/rule errors & warnings immediately as user types/selects!
  const immediateError = issues.find((i) => i.severity === "error" && i.code !== "required_field");
  if (immediateError) return immediateError;

  // Show required_field error as soon as blurred/touched or Next Step clicked
  const requiredError = issues.find((i) => i.severity === "error" && i.code === "required_field");
  if (requiredError && isTouchedOrAttempted) return requiredError;

  // Otherwise show helpful non-blocking warning immediately
  const warning = issues.find((i) => i.severity === "warning");
  return warning || null;
}
