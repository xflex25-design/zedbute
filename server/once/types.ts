export interface OncePrimaryArtistInput {
  name: string;
  spotify_artist_url?: string;
  apple_music_artist_url?: string;
  soundcloud_artist_url?: string;
  meta_artist_url?: string;
}

export interface OnceWriterInput {
  name: string;
  society?: string;
  ipi?: string;
  share_percent?: number;
}

export interface OnceContributorInput {
  name?: string;
  role?: string;
  roleId?: number;
  contributorRoleGroupId?: number;
}

export interface OnceArtistLocalizationInput {
  name: string;
  language_and_script_code: string;
  type?: string;
}

export interface OnceTitleLocalizationInput {
  title: string;
  language_and_script_code: string;
}

export interface OnceTrackInput {
  title: string;
  title_version?: string;
  primary_artist_name?: string;
  primary_artists?: OncePrimaryArtistInput[];
  featured_artist_names?: string[];
  audio_file_url: string;
  explicit_flag: boolean;
  is_instrumental?: boolean;
  contains_ai?: boolean;
  track_type?: "original" | "cover" | "public_domain";
  isrc?: string;
  genre?: string;
  language?: string;
  language_and_script_code?: string;
  lyrics?: string;
  preview_start_seconds?: number;
  pline_year?: string;
  pline_owner?: string;
  cline_year?: string;
  cline_owner?: string;
  writers: OnceWriterInput[];
  contributors?: OnceContributorInput[];
  artist_locals?: OnceArtistLocalizationInput[];
  title_locals?: OnceTitleLocalizationInput[];
  audio_metadata?: AudioFileInspection;
}

export interface OnceReleaseInput {
  title: string;
  title_version?: string;
  primary_artist_name: string;
  primary_artists?: OncePrimaryArtistInput[];
  featured_artist_names?: string[];
  type?: "single" | "ep" | "album";
  description?: string;
  spotify_artist_url?: string;
  apple_music_artist_url?: string;
  spotify_artist_urls?: Array<string | null>;
  apple_music_artist_urls?: Array<string | null>;
  genre: string;
  sub_genre?: string;
  second_genre?: string;
  release_date: string;
  original_release_date?: string;
  upc?: string | null;
  label?: string;
  audio_language?: string;
  metadata_language?: string;
  metadata_language_country?: string;
  language_and_script_code?: string;
  distribution_store_ids?: number[] | null;
  pline_year?: string;
  pline_owner?: string;
  cline_year?: string;
  cline_owner?: string;
  cover_art_file_url: string;
  cover_art_metadata?: CoverArtInspection;
  contributors?: OnceContributorInput[];
  artist_locals?: OnceArtistLocalizationInput[];
  title_locals?: OnceTitleLocalizationInput[];
}

export interface AudioFileInspection {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  format: string;
  durationSeconds?: number;
  sampleRateHz?: number;
  bitDepth?: number;
  channels?: number;
}

export interface CoverArtInspection {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  aspectRatio?: number;
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationReport {
  valid: boolean;
  submittable: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  missingFields: string[];
  schemaSource: "live" | "openapi_spec";
  rulesSource: "live" | "cached_spec";
  checkedAt: string;
}

export interface SubmitReleaseRequest {
  release: OnceReleaseInput;
  tracks: OnceTrackInput[];
  release_id?: string;
  conversation_id?: string;
  token_offset?: boolean;
  distributors?: Record<string, unknown>;
  skip_adapters?: boolean;
  rights_confirmed?: boolean;
}

export interface DraftRequest {
  release?: Partial<OnceReleaseInput>;
  tracks?: Array<Partial<OnceTrackInput>>;
  track_patches?: Record<string, unknown>[];
  upload_requests?: Record<string, unknown>[];
  status?: string;
  mode?: "delta" | "replace";
  release_id?: string;
  once_draft_id?: string;
  local_release_id?: string;
  current_step?: number;
  distribution_mode?: "once_api" | "manual_k70";
  conversation_id?: string;
  wizard_state?: Record<string, unknown>;
}

export interface DistributionStore {
  storeId: number;
  name: string;
  featured: boolean;
  enabledByDefault: boolean;
  partnerOnly: boolean;
  aliases: string[];
}

export interface DistributionStoresResponse {
  stores: DistributionStore[];
  defaultStoreIds: number[];
  selectionSemantics?: string;
}

export interface AIDetectionResponse {
  containsAi: boolean;
  aiScore: number;
  predictedModel?: string;
  cached?: boolean;
}

export interface ACRBestMatch {
  title?: string;
  artist?: string;
  isrc?: string;
  queryMatchPercentage?: number;
  confidence?: number;
  dspLinks?: string[];
}

export interface ACRCheckResponse {
  matched: boolean;
  bestMatch?: ACRBestMatch;
  cached?: boolean;
}

export interface ReleaseQuoteCost {
  trackCredits: number;
  tokenOffsetCredits: number;
  totalCredits: number;
  totalUsd: number;
}

export interface ReleaseQuoteBalance {
  currentCredits: number;
  balanceAfter: number;
  covered: boolean;
  deficitCredits: number;
}

export interface ReleaseQuoteResponse {
  cost: ReleaseQuoteCost;
  balance: ReleaseQuoteBalance;
}

export interface StoreStatus {
  storeId: number;
  storeName: string;
  statusText: string;
  urlInStore?: string;
  linkPending?: boolean;
}

export interface ArtistProfile {
  name: string;
  isPrimary: boolean;
  appleMusicArtistId?: string | null;
  appleMusicArtistUrl?: string | null;
  spotifyArtistId?: string | null;
  spotifyArtistUri?: string | null;
  spotifyArtistUrl?: string | null;
}

export interface ReleaseStatusResponse {
  aggregateStatus: string; // queued, draft, pending, processing, under_review, approved, delivered, distributed, live, failed, rejected
  pending?: boolean;
  storeStatuses: StoreStatus[];
  artistProfiles?: ArtistProfile[];
  fallback?: boolean;
  fallbackReason?: string;
}

export interface OnceWebhookPayload {
  event: "release.status_changed" | "release.approved";
  releaseId: string;
  title: string;
  artist: string;
  previousStatus?: string;
  status: string;
  storeStatuses: StoreStatus[];
  artistProfiles: ArtistProfile[];
  occurredAt?: string;
  upc?: string;
  tracks?: Array<{ isrc?: string; title?: string }>;
}

export interface OnceDistributionReleaseRecord {
  id: string;
  release_id?: string;
  user_id: string;
  once_release_id?: string;
  once_draft_id?: string;
  title: string;
  primary_artist: string;
  release_type: string;
  upc?: string;
  isrc?: string;
  cover_art_url?: string;
  audio_url?: string;
  metadata: Record<string, unknown>;
  distribution_store_ids: number[];
  store_statuses: StoreStatus[];
  artist_profiles: ArtistProfile[];
  status: string;
  is_ai_detected: boolean;
  ai_score?: number;
  predicted_ai_model?: string;
  acr_matched: boolean;
  acr_best_match?: ACRBestMatch;
  credit_cost: number;
  credits_debited: number;
  submission_error?: string;
  validation_errors?: ValidationIssue[];
  current_step?: number;
  last_quote?: ReleaseQuoteResponse | null;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  submitted_at?: string;
  approved_at?: string;
  distributed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OnceAuditLogRecord {
  id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role: "artist" | "admin" | "system" | "webhook";
  action: string;
  release_id?: string | null;
  once_release_id?: string | null;
  status: "info" | "success" | "warning" | "error";
  summary: string;
  details: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
}

export interface OnceEngineSettingsRecord {
  id: string;
  auto_distribute_default: boolean;
  require_admin_approval: boolean;
  single_upload_price_zmw: number;
  updated_at: string;
}

export type AnalyticsDatePreset = "7d" | "30d" | "90d" | "12m" | "custom";

export interface OnceFreshnessMetadata {
  storesThrough: string | null;
  storesSyncedAt: string | null;
  youtubeLatestSnapshot: string | null;
  youtubeSyncedAt: string | null;
  royaltiesSyncedAt?: string | null;
}

export interface OncePerformanceKpis {
  totalStreams: number;
  avgDailyStreams: number;
  periodChangePct: number | null;
  topStore: {
    name: string;
    share: number;
  } | null;
}

export interface OnceDailyMetric {
  eventDate: string;
  streamsCount: number;
}

export interface OnceStoreMetric {
  id: number;
  name: string;
  total: number;
}

export interface OnceTopReleaseMetric {
  releaseId: string;
  title: string;
  primaryArtistName: string;
  coverArtFileUrl?: string | null;
  streamsCount: number;
  storeStreams: number;
  youtubeViews: number;
  zedbuteReleaseId?: string;
}

export interface OnceTrackPerformanceMetric {
  trackId: number | null;
  onceTrackId: string;
  trackName: string;
  artistName: string;
  streamsCount: number;
  storeStreams: number;
  youtubeViews: number;
}

export interface OncePerformanceSummaryResponse {
  fromDate: string;
  toDate: string;
  releases: {
    total: number;
    withRevelatorId: number;
  };
  metrics: OnceDailyMetric[];
  kpis: OncePerformanceKpis;
  topStores: OnceStoreMetric[];
  topReleases: OnceTopReleaseMetric[];
  freshness: OnceFreshnessMetadata;
}

export interface OnceReleasePerformanceResponse {
  releaseId: string;
  fromDate: string;
  toDate: string;
  distributorId: number | null;
  metrics: OnceDailyMetric[];
  kpis: OncePerformanceKpis;
  distributors: OnceStoreMetric[];
  tracks?: OnceTrackPerformanceMetric[];
  storeScope: string | null;
  freshness: OnceFreshnessMetadata;
}

export interface ZedbuteAnalyticsReleaseOption {
  id: string;
  onceReleaseId: string;
  title: string;
  primaryArtist: string;
  status: string;
  coverArtUrl?: string | null;
  userId?: string;
}

export interface ZedbuteArtistAnalyticsPayload {
  configured: boolean;
  hasDistributedReleases: boolean;
  preset: AnalyticsDatePreset;
  fromDate: string;
  toDate: string;
  minAllowedDate: string;
  maxAllowedDate: string;
  scopeMode: "artist_account" | "owned_releases_aggregated";
  releasesCount: number;
  distributedReleasesCount: number;
  availableReleases: ZedbuteAnalyticsReleaseOption[];
  kpis: OncePerformanceKpis;
  metrics: OnceDailyMetric[];
  topStores: OnceStoreMetric[];
  topReleases: OnceTopReleaseMetric[];
  freshness: OnceFreshnessMetadata | null;
  notice?: string;
}

export interface ZedbuteReleaseAnalyticsPayload {
  configured: boolean;
  release: ZedbuteAnalyticsReleaseOption;
  preset: AnalyticsDatePreset;
  fromDate: string;
  toDate: string;
  minAllowedDate: string;
  maxAllowedDate: string;
  distributorId: number | null;
  notDistributed?: boolean;
  kpis: OncePerformanceKpis;
  metrics: OnceDailyMetric[];
  distributors: OnceStoreMetric[];
  platformHighlights: {
    spotifyStreams: number;
    appleMusicStreams: number;
    youtubeMusicViews: number;
    otherStoresStreams: number;
  };
  tracks: OnceTrackPerformanceMetric[];
  storeScope: string | null;
  freshness: OnceFreshnessMetadata | null;
  notice?: string;
}

export interface ZedbuteAdminAnalyticsPayload {
  configured: boolean;
  preset: AnalyticsDatePreset;
  fromDate: string;
  toDate: string;
  minAllowedDate: string;
  maxAllowedDate: string;
  managedArtistsCount: number;
  managedReleasesCount: number;
  distributedReleasesCount: number;
  kpis: OncePerformanceKpis;
  metrics: OnceDailyMetric[];
  topStores: OnceStoreMetric[];
  topReleases: OnceTopReleaseMetric[];
  freshness: OnceFreshnessMetadata | null;
  notice?: string;
}
