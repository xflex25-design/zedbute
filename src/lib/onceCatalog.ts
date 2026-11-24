// Official ONCE metadata & technical asset specifications synced with once.app/v1 & docs.once.app

export const ONCE_GENRE_OPTIONS = [
  "Afrobeat",
  "Afrobeats",
  "Gospel",
  "Hip-Hop/Rap",
  "R&B/Soul",
  "Pop",
  "Dance",
  "Electronic",
  "Reggae",
  "Traditional",
  "World",
  "Rock",
  "Alternative",
  "Jazz",
  "Blues",
  "Country",
  "Folk",
  "Latin",
  "Classical",
  "Soundtrack",
  "Spoken Word",
  "Instrumental",
] as const;

export const ONCE_SUBGENRE_OPTIONS = [
  "Dance Pop",
  "Afropop",
  "Afro-Fusion",
  "Amapiano",
  "Zed Beats",
  "Kalindula",
  "Contemporary Gospel",
  "Praise & Worship",
  "Trap",
  "Boom Bap",
  "Conscious Hip-Hop",
  "Contemporary R&B",
  "Neo-Soul",
  "Synth-Pop",
  "Indie Pop",
  "House",
  "Deep House",
  "Dancehall",
  "Roots Reggae",
  "Acoustic",
  "Alternative R&B",
  "Ambient",
  "Instrumental",
] as const;

export interface LanguageOption {
  code: string;
  label: string;
  ugcRestricted?: boolean;
}

export const ONCE_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "bem", label: "Bemba" },
  { code: "ny", label: "Nyanja / Chichewa" },
  { code: "toi", label: "Tonga" },
  { code: "loz", label: "Lozi" },
  { code: "lun", label: "Lunda" },
  { code: "kqn", label: "Kaonde" },
  { code: "lue", label: "Luvale" },
  { code: "sw", label: "Swahili" },
  { code: "zu", label: "Zulu" },
  { code: "yo", label: "Yoruba" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese", ugcRestricted: true },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi", ugcRestricted: true },
  { code: "id", label: "Indonesian", ugcRestricted: true },
  { code: "vi", label: "Vietnamese", ugcRestricted: true },
  { code: "tr", label: "Turkish", ugcRestricted: true },
  { code: "ur", label: "Urdu", ugcRestricted: true },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "zxx", label: "Instrumental (No Lyrics)" },
];

export const CLIENT_AUDIO_SPECS = {
  acceptedFormatsLabel: "WAV (recommended), FLAC, MP3, AAC, M4A, OGG, AIFF, MP4",
  acceptAttr: ".wav,.flac,.mp3,.aac,.m4a,.ogg,.aiff,.aif,.mp4,audio/*",
  acceptedExtensions: [".wav", ".flac", ".mp3", ".aac", ".m4a", ".ogg", ".aiff", ".aif", ".mp4"],
  maxFileSizeBytes: 1024 * 1024 * 1024, // 1 GB
  chunkThresholdBytes: 4 * 1024 * 1024, // 4 MB
  chunkSizeBytes: 5 * 1024 * 1024, // 5 MB recommended by ONCE /uploads docs
  minSampleRateHz: 44100,
  minBitDepth: 16,
  minDurationSeconds: 10,
  recommendedMinDurationSeconds: 30,
};

export const CLIENT_COVER_SPECS = {
  acceptedFormatsLabel: "Square JPG or PNG (3000×3000 px recommended, minimum 1400×1400 px)",
  acceptAttr: ".jpg,.jpeg,.png,image/jpeg,image/png",
  acceptedMimeTypes: ["image/jpeg", "image/jpg", "image/png"],
  minDimensionPx: 1400,
  recommendedDimensionPx: 3000,
  maxDimensionPx: 6000,
  maxFileSizeBytes: 50 * 1024 * 1024,
};
