import {
  getAllManagedReleases,
  getUserOwnedReleases,
  getVerifiedOwnedRelease,
  resolveOnceTokenForUser,
  type AuthenticatedZedbuteUser,
} from "./auth";
import { onceMcpClient, OnceMcpError } from "./mcpClient";
import type {
  AnalyticsDatePreset,
  OnceDailyMetric,
  OnceDistributionReleaseRecord,
  OnceFreshnessMetadata,
  OncePerformanceKpis,
  OnceReleasePerformanceResponse,
  OnceStoreMetric,
  OnceTopReleaseMetric,
  ZedbuteAdminAnalyticsPayload,
  ZedbuteAnalyticsReleaseOption,
  ZedbuteArtistAnalyticsPayload,
  ZedbuteReleaseAnalyticsPayload,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PRESET_DAYS: Record<Exclude<AnalyticsDatePreset, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

const DISTRIBUTABLE_STATUSES = new Set([
  "approved",
  "delivered",
  "distributed",
  "live",
  "taken_down",
]);

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseStrictUtcDate(dateStr: string): Date | null {
  if (!DATE_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function getTwoYearBounds(): { minDate: Date; minDateStr: string; maxDate: Date; maxDateStr: string; yesterdayStr: string } {
  const now = new Date();
  const maxDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const minDate = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()));
  const yesterday = addUtcDays(maxDate, -1);
  return {
    minDate,
    minDateStr: formatUtcDate(minDate),
    maxDate,
    maxDateStr: formatUtcDate(maxDate),
    yesterdayStr: formatUtcDate(yesterday),
  };
}

export interface ValidatedDateRange {
  preset: AnalyticsDatePreset;
  fromDate: string;
  toDate: string;
  minAllowedDate: string;
  maxAllowedDate: string;
  windowDays: number;
  omitDatesOnDirectSummary: boolean;
  previousWindow: { fromDate: string; toDate: string } | null;
}

export function validateAnalyticsDateRange(params: {
  range?: string;
  fromDate?: string;
  toDate?: string;
}): ValidatedDateRange {
  const { minDate, minDateStr, maxDate, maxDateStr, yesterdayStr } = getTwoYearBounds();

  const rawRange = (params.range || "").trim().toLowerCase();
  const hasExplicitDates = Boolean(params.fromDate || params.toDate);

  let preset: AnalyticsDatePreset;
  if (hasExplicitDates || rawRange === "custom") {
    preset = "custom";
  } else if (rawRange === "7d" || rawRange === "30d" || rawRange === "90d" || rawRange === "12m") {
    preset = rawRange;
  } else if (!rawRange) {
    preset = "30d";
  } else {
    throw new OnceMcpError({
      status: 400,
      code: "invalid_params",
      message: "Invalid date range preset. Supported values: 7d, 30d, 90d, 12m, custom.",
    });
  }

  let fromDt: Date;
  let toDt: Date;
  let omitDatesOnDirectSummary = false;

  if (preset !== "custom") {
    const days = PRESET_DAYS[preset];
    toDt = parseStrictUtcDate(yesterdayStr)!;
    fromDt = addUtcDays(toDt, -(days - 1));
    if (fromDt < minDate) {
      fromDt = minDate;
    }
    if (preset === "30d") {
      omitDatesOnDirectSummary = true;
    }
  } else {
    if (!params.fromDate || !params.toDate) {
      throw new OnceMcpError({
        status: 400,
        code: "invalid_params",
        message: "Both fromDate and toDate (YYYY-MM-DD) are required for a custom date range.",
      });
    }

    const parsedFrom = parseStrictUtcDate(params.fromDate.trim());
    const parsedTo = parseStrictUtcDate(params.toDate.trim());

    if (!parsedFrom || !parsedTo) {
      throw new OnceMcpError({
        status: 400,
        code: "invalid_params",
        message: "Dates must be valid calendar days in YYYY-MM-DD format.",
      });
    }

    if (parsedFrom > parsedTo) {
      throw new OnceMcpError({
        status: 400,
        code: "invalid_params",
        message: "fromDate cannot be after toDate.",
      });
    }

    if (parsedFrom < minDate) {
      throw new OnceMcpError({
        status: 400,
        code: "invalid_params",
        message: `ONCE analytics supports up to 2 years of history (earliest allowed date: ${minDateStr}).`,
      });
    }

    if (parsedTo > maxDate) {
      throw new OnceMcpError({
        status: 400,
        code: "invalid_params",
        message: `toDate cannot be in the future (latest allowed date: ${maxDateStr}).`,
      });
    }

    fromDt = parsedFrom;
    toDt = parsedTo;
  }

  const windowDays = Math.floor((toDt.getTime() - fromDt.getTime()) / MS_PER_DAY) + 1;
  if (windowDays > 731) {
    throw new OnceMcpError({
      status: 400,
      code: "invalid_params",
      message: "Requested date window exceeds the 2-year maximum historical limit.",
    });
  }

  const prevToDt = addUtcDays(fromDt, -1);
  const prevFromDt = addUtcDays(prevToDt, -(windowDays - 1));
  const previousWindow =
    prevFromDt >= minDate
      ? { fromDate: formatUtcDate(prevFromDt), toDate: formatUtcDate(prevToDt) }
      : null;

  return {
    preset,
    fromDate: formatUtcDate(fromDt),
    toDate: formatUtcDate(toDt),
    minAllowedDate: minDateStr,
    maxAllowedDate: maxDateStr,
    windowDays,
    omitDatesOnDirectSummary,
    previousWindow,
  };
}

function toReleaseOption(r: OnceDistributionReleaseRecord): ZedbuteAnalyticsReleaseOption {
  return {
    id: r.id,
    onceReleaseId: r.once_release_id || r.id,
    title: r.title,
    primaryArtist: r.primary_artist,
    status: r.status,
    coverArtUrl: r.cover_art_url || null,
    userId: r.user_id,
  };
}

function aggregateReleasePerformances(params: {
  items: Array<{
    release: OnceDistributionReleaseRecord;
    current: OnceReleasePerformanceResponse;
    previous?: OnceReleasePerformanceResponse | null;
  }>;
  fallbackFromDate: string;
  fallbackToDate: string;
  fallbackWindowDays: number;
}): {
  fromDate: string;
  toDate: string;
  kpis: OncePerformanceKpis;
  metrics: OnceDailyMetric[];
  topStores: OnceStoreMetric[];
  topReleases: OnceTopReleaseMetric[];
  freshness: OnceFreshnessMetadata | null;
} {
  const { items } = params;
  if (items.length === 0) {
    return {
      fromDate: params.fallbackFromDate,
      toDate: params.fallbackToDate,
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      topStores: [],
      topReleases: [],
      freshness: null,
    };
  }

  const fromDate = items[0].current.fromDate || params.fallbackFromDate;
  const toDate = items[0].current.toDate || params.fallbackToDate;

  const fromDt = parseStrictUtcDate(fromDate);
  const toDt = parseStrictUtcDate(toDate);
  const actualDays =
    fromDt && toDt
      ? Math.max(1, Math.floor((toDt.getTime() - fromDt.getTime()) / MS_PER_DAY) + 1)
      : Math.max(1, params.fallbackWindowDays);

  const dailyTotals = new Map<string, number>();
  const storeTotals = new Map<number, { id: number; name: string; total: number }>();
  const topReleases: OnceTopReleaseMetric[] = [];
  let totalStreams = 0;
  let totalPreviousStreams = 0;
  let hasAnyPreviousWindow = false;
  let freshness: OnceFreshnessMetadata | null = null;

  for (const item of items) {
    const perf = item.current;
    if (!freshness && perf.freshness) {
      freshness = perf.freshness;
    }

    const releaseTotal = perf.kpis?.totalStreams ?? 0;
    totalStreams += releaseTotal;

    if (item.previous) {
      hasAnyPreviousWindow = true;
      totalPreviousStreams += item.previous.kpis?.totalStreams ?? 0;
    }

    for (const m of perf.metrics || []) {
      dailyTotals.set(m.eventDate, (dailyTotals.get(m.eventDate) || 0) + (m.streamsCount || 0));
    }

    let youtubeViews = 0;
    let storeStreams = 0;
    for (const d of perf.distributors || []) {
      const existing = storeTotals.get(d.id);
      storeTotals.set(d.id, {
        id: d.id,
        name: d.name,
        total: (existing?.total || 0) + (d.total || 0),
      });
      if (d.id === -1300 || d.name.toLowerCase().includes("youtube music")) {
        youtubeViews += d.total || 0;
      } else {
        storeStreams += d.total || 0;
      }
    }

    // If distributors were empty despite non-zero total, keep storeStreams aligned
    if ((perf.distributors || []).length === 0 && releaseTotal > 0) {
      storeStreams = releaseTotal;
    }

    topReleases.push({
      releaseId: item.release.once_release_id || perf.releaseId,
      zedbuteReleaseId: item.release.id,
      title: item.release.title,
      primaryArtistName: item.release.primary_artist,
      coverArtFileUrl: item.release.cover_art_url || null,
      streamsCount: releaseTotal,
      storeStreams,
      youtubeViews,
    });
  }

  const metrics: OnceDailyMetric[] = Array.from(dailyTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([eventDate, streamsCount]) => ({ eventDate, streamsCount }));

  const topStores: OnceStoreMetric[] = Array.from(storeTotals.values()).sort(
    (a, b) => b.total - a.total
  );

  topReleases.sort((a, b) => b.streamsCount - a.streamsCount);

  const avgDailyStreams = Number((totalStreams / actualDays).toFixed(1));

  let periodChangePct: number | null = null;
  if (items.length === 1 && items[0].current.kpis?.periodChangePct !== undefined) {
    periodChangePct = items[0].current.kpis.periodChangePct;
  } else if (hasAnyPreviousWindow && totalPreviousStreams > 0) {
    periodChangePct = Number(
      (((totalStreams - totalPreviousStreams) / totalPreviousStreams) * 100).toFixed(1)
    );
  }

  const leadingStore = topStores[0];
  const topStore =
    leadingStore && totalStreams > 0
      ? {
          name: leadingStore.name,
          share: Number((leadingStore.total / totalStreams).toFixed(4)),
        }
      : null;

  return {
    fromDate,
    toDate,
    kpis: {
      totalStreams,
      avgDailyStreams,
      periodChangePct,
      topStore,
    },
    metrics,
    topStores,
    topReleases,
    freshness,
  };
}

async function fetchPerformancesForReleases(params: {
  entries: Array<{ release: OnceDistributionReleaseRecord; token: string }>;
  dateRange: ValidatedDateRange;
  fetchPreviousForGrowth: boolean;
}): Promise<{
  results: Array<{
    release: OnceDistributionReleaseRecord;
    current: OnceReleasePerformanceResponse;
    previous?: OnceReleasePerformanceResponse | null;
  }>;
  authFailure?: OnceMcpError;
  notDistributedCount: number;
}> {
  const results: Array<{
    release: OnceDistributionReleaseRecord;
    current: OnceReleasePerformanceResponse;
    previous?: OnceReleasePerformanceResponse | null;
  }> = [];
  let notDistributedCount = 0;
  let authFailure: OnceMcpError | undefined;

  const settled = await Promise.allSettled(
    params.entries.map(async ({ release, token }) => {
      const onceId = release.once_release_id!;
      const current = await onceMcpClient.getReleasePerformance(
        {
          releaseId: onceId,
          fromDate: params.dateRange.omitDatesOnDirectSummary ? undefined : params.dateRange.fromDate,
          toDate: params.dateRange.omitDatesOnDirectSummary ? undefined : params.dateRange.toDate,
          includeTracks: false,
        },
        token
      );

      let previous: OnceReleasePerformanceResponse | null = null;
      if (params.fetchPreviousForGrowth && params.dateRange.previousWindow && params.entries.length > 1) {
        try {
          previous = await onceMcpClient.getReleasePerformance(
            {
              releaseId: onceId,
              fromDate: params.dateRange.previousWindow.fromDate,
              toDate: params.dateRange.previousWindow.toDate,
              includeTracks: false,
            },
            token
          );
        } catch {
          previous = null;
        }
      }

      return { release, current, previous };
    })
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      const err = outcome.reason;
      if (err instanceof OnceMcpError) {
        if (err.code === "release_not_distributed" || err.status === 409) {
          notDistributedCount++;
          continue;
        }
        if (err.status === 401 || err.status === 403) {
          authFailure = err;
        }
      }
    }
  }

  return { results, authFailure, notDistributedCount };
}

export async function buildArtistAnalyticsOverview(
  authUser: AuthenticatedZedbuteUser,
  dateRange: ValidatedDateRange
): Promise<ZedbuteArtistAnalyticsPayload> {
  const ownedReleases = await getUserOwnedReleases(authUser);
  const onceReleases = ownedReleases.filter((r) => Boolean(r.once_release_id));
  const availableReleases = onceReleases.map(toReleaseOption);

  const { token, isDedicatedUserToken } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
  if (!token) {
    return {
      configured: false,
      hasDistributedReleases: onceReleases.some((r) => DISTRIBUTABLE_STATUSES.has(r.status)),
      preset: dateRange.preset,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      scopeMode: isDedicatedUserToken ? "artist_account" : "owned_releases_aggregated",
      releasesCount: ownedReleases.length,
      distributedReleasesCount: onceReleases.length,
      availableReleases,
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      topStores: [],
      topReleases: [],
      freshness: null,
      notice: "ONCE analytics credentials are not configured yet. Connect your ONCE account or configure ONCE_ACCESS_TOKEN on the server.",
    };
  }

  // Dedicated artist ONCE token: directly use get_performance_summary
  if (isDedicatedUserToken) {
    const summary = await onceMcpClient.getPerformanceSummary(
      {
        fromDate: dateRange.omitDatesOnDirectSummary ? undefined : dateRange.fromDate,
        toDate: dateRange.omitDatesOnDirectSummary ? undefined : dateRange.toDate,
        topReleasesLimit: 20,
        topStoresLimit: 20,
      },
      token
    );

    const onceIdToZedbuteId = new Map(
      onceReleases.map((r) => [r.once_release_id!, r.id])
    );

    return {
      configured: true,
      hasDistributedReleases: summary.releases.total > 0 || onceReleases.length > 0,
      preset: dateRange.preset,
      fromDate: summary.fromDate || dateRange.fromDate,
      toDate: summary.toDate || dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      scopeMode: "artist_account",
      releasesCount: Math.max(ownedReleases.length, summary.releases?.total || 0),
      distributedReleasesCount: summary.releases?.withRevelatorId || onceReleases.length,
      availableReleases,
      kpis: summary.kpis,
      metrics: summary.metrics || [],
      topStores: summary.topStores || [],
      topReleases: (summary.topReleases || []).map((rel) => ({
        ...rel,
        zedbuteReleaseId: onceIdToZedbuteId.get(rel.releaseId),
      })),
      freshness: summary.freshness || null,
    };
  }

  // Shared partner token: strictly aggregate ONLY releases owned by this authenticated artist
  if (onceReleases.length === 0) {
    return {
      configured: true,
      hasDistributedReleases: false,
      preset: dateRange.preset,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      scopeMode: "owned_releases_aggregated",
      releasesCount: ownedReleases.length,
      distributedReleasesCount: 0,
      availableReleases: [],
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      topStores: [],
      topReleases: [],
      freshness: null,
      notice: "You do not have any releases distributed via ONCE yet. Once a release is approved and distributed, daily streaming data will appear here.",
    };
  }

  const { results, authFailure, notDistributedCount } = await fetchPerformancesForReleases({
    entries: onceReleases.map((release) => ({ release, token })),
    dateRange,
    fetchPreviousForGrowth: true,
  });

  if (results.length === 0 && authFailure) {
    throw authFailure;
  }

  const aggregated = aggregateReleasePerformances({
    items: results,
    fallbackFromDate: dateRange.fromDate,
    fallbackToDate: dateRange.toDate,
    fallbackWindowDays: dateRange.windowDays,
  });

  return {
    configured: true,
    hasDistributedReleases: results.length > 0,
    preset: dateRange.preset,
    fromDate: aggregated.fromDate,
    toDate: aggregated.toDate,
    minAllowedDate: dateRange.minAllowedDate,
    maxAllowedDate: dateRange.maxAllowedDate,
    scopeMode: "owned_releases_aggregated",
    releasesCount: ownedReleases.length,
    distributedReleasesCount: results.length,
    availableReleases,
    kpis: aggregated.kpis,
    metrics: aggregated.metrics,
    topStores: aggregated.topStores,
    topReleases: aggregated.topReleases,
    freshness: aggregated.freshness,
    notice:
      results.length === 0 && notDistributedCount > 0
        ? "Your ONCE releases have not finished distribution yet. Streaming analytics become available after distribution and store reporting."
        : undefined,
  };
}

export async function buildReleaseAnalytics(
  authUser: AuthenticatedZedbuteUser,
  releaseIdOrOnceId: string,
  dateRange: ValidatedDateRange,
  distributorId?: number
): Promise<ZedbuteReleaseAnalyticsPayload> {
  // Strictly enforce release ownership before calling ONCE MCP
  const ownership = await getVerifiedOwnedRelease(releaseIdOrOnceId, authUser);
  if ("error" in ownership) {
    throw new OnceMcpError({
      status: ownership.status,
      code: ownership.status === 403 ? "forbidden" : "invalid_params",
      message: ownership.error,
    });
  }

  const release = ownership.release;
  const releaseOption = toReleaseOption(release);

  if (!release.once_release_id) {
    return {
      configured: true,
      release: releaseOption,
      preset: dateRange.preset,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      distributorId: distributorId ?? null,
      notDistributed: true,
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      distributors: [],
      platformHighlights: {
        spotifyStreams: 0,
        appleMusicStreams: 0,
        youtubeMusicViews: 0,
        otherStoresStreams: 0,
      },
      tracks: [],
      storeScope: null,
      freshness: null,
      notice: "This release has not been assigned an ONCE release ID or distributed via ONCE yet.",
    };
  }

  const { token } = await resolveOnceTokenForUser(authUser.id, authUser.dbClient);
  if (!token) {
    return {
      configured: false,
      release: releaseOption,
      preset: dateRange.preset,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      distributorId: distributorId ?? null,
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      distributors: [],
      platformHighlights: {
        spotifyStreams: 0,
        appleMusicStreams: 0,
        youtubeMusicViews: 0,
        otherStoresStreams: 0,
      },
      tracks: [],
      storeScope: null,
      freshness: null,
      notice: "ONCE analytics credentials are not configured on the server.",
    };
  }

  try {
    const perf = await onceMcpClient.getReleasePerformance(
      {
        releaseId: release.once_release_id,
        fromDate: dateRange.omitDatesOnDirectSummary ? undefined : dateRange.fromDate,
        toDate: dateRange.omitDatesOnDirectSummary ? undefined : dateRange.toDate,
        distributorId,
        includeTracks: true,
      },
      token
    );

    let spotifyStreams = 0;
    let appleMusicStreams = 0;
    let youtubeMusicViews = 0;
    let otherStoresStreams = 0;

    for (const store of perf.distributors || []) {
      const lower = store.name.toLowerCase();
      if (store.id === 9 || lower.includes("spotify")) {
        spotifyStreams += store.total || 0;
      } else if (store.id === 1 || lower.includes("apple music")) {
        appleMusicStreams += store.total || 0;
      } else if (store.id === -1300 || lower.includes("youtube music")) {
        youtubeMusicViews += store.total || 0;
      } else {
        otherStoresStreams += store.total || 0;
      }
    }

    return {
      configured: true,
      release: releaseOption,
      preset: dateRange.preset,
      fromDate: perf.fromDate || dateRange.fromDate,
      toDate: perf.toDate || dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      distributorId: perf.distributorId ?? distributorId ?? null,
      kpis: perf.kpis,
      metrics: perf.metrics || [],
      distributors: perf.distributors || [],
      platformHighlights: {
        spotifyStreams,
        appleMusicStreams,
        youtubeMusicViews,
        otherStoresStreams,
      },
      tracks: perf.tracks || [],
      storeScope: perf.storeScope ?? null,
      freshness: perf.freshness || null,
    };
  } catch (err) {
    if (err instanceof OnceMcpError && (err.code === "release_not_distributed" || err.status === 409)) {
      return {
        configured: true,
        release: releaseOption,
        preset: dateRange.preset,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        minAllowedDate: dateRange.minAllowedDate,
        maxAllowedDate: dateRange.maxAllowedDate,
        distributorId: distributorId ?? null,
        notDistributed: true,
        kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
        metrics: [],
        distributors: [],
        platformHighlights: {
          spotifyStreams: 0,
          appleMusicStreams: 0,
          youtubeMusicViews: 0,
          otherStoresStreams: 0,
        },
        tracks: [],
        storeScope: null,
        freshness: null,
        notice: "This release has not been distributed yet. Streaming metrics begin appearing after store delivery and reporting.",
      };
    }
    throw err;
  }
}

export async function buildAdminAnalyticsOverview(
  authUser: AuthenticatedZedbuteUser,
  dateRange: ValidatedDateRange
): Promise<ZedbuteAdminAnalyticsPayload> {
  if (!authUser.isAdmin) {
    throw new OnceMcpError({
      status: 403,
      code: "forbidden",
      message: "Administrator access required",
    });
  }

  const managedReleases = await getAllManagedReleases(authUser);
  const managedOnceReleases = managedReleases.filter((r) => Boolean(r.once_release_id));
  const managedArtistIds = new Set(managedReleases.map((r) => r.user_id));

  // Resolve per-artist encrypted tokens (with partner ONCE_ACCESS_TOKEN fallback)
  const tokenCache = new Map<string, string>();
  const entries: Array<{ release: OnceDistributionReleaseRecord; token: string }> = [];

  for (const rel of managedOnceReleases) {
    let tok = tokenCache.get(rel.user_id);
    if (tok === undefined) {
      const resolved = await resolveOnceTokenForUser(rel.user_id, authUser.dbClient);
      tok = resolved.token;
      tokenCache.set(rel.user_id, tok);
    }
    if (tok) {
      entries.push({ release: rel, token: tok });
    }
  }

  const hasAnyToken = Boolean(process.env.ONCE_ACCESS_TOKEN) || entries.length > 0;
  if (!hasAnyToken) {
    return {
      configured: false,
      preset: dateRange.preset,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      managedArtistsCount: managedArtistIds.size,
      managedReleasesCount: managedReleases.length,
      distributedReleasesCount: 0,
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      topStores: [],
      topReleases: [],
      freshness: null,
      notice: "ONCE analytics credentials are not configured yet. Configure ONCE_ACCESS_TOKEN on the server to retrieve Zedbute-managed artist performance.",
    };
  }

  if (entries.length === 0) {
    return {
      configured: true,
      preset: dateRange.preset,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      minAllowedDate: dateRange.minAllowedDate,
      maxAllowedDate: dateRange.maxAllowedDate,
      managedArtistsCount: managedArtistIds.size,
      managedReleasesCount: managedReleases.length,
      distributedReleasesCount: 0,
      kpis: { totalStreams: 0, avgDailyStreams: 0, periodChangePct: null, topStore: null },
      metrics: [],
      topStores: [],
      topReleases: [],
      freshness: null,
      notice: "No Zedbute-managed ONCE releases are ready for analytics reporting yet.",
    };
  }

  const { results, authFailure, notDistributedCount } = await fetchPerformancesForReleases({
    entries,
    dateRange,
    fetchPreviousForGrowth: true,
  });

  if (results.length === 0 && authFailure) {
    throw authFailure;
  }

  const aggregated = aggregateReleasePerformances({
    items: results,
    fallbackFromDate: dateRange.fromDate,
    fallbackToDate: dateRange.toDate,
    fallbackWindowDays: dateRange.windowDays,
  });

  return {
    configured: true,
    preset: dateRange.preset,
    fromDate: aggregated.fromDate,
    toDate: aggregated.toDate,
    minAllowedDate: dateRange.minAllowedDate,
    maxAllowedDate: dateRange.maxAllowedDate,
    managedArtistsCount: managedArtistIds.size,
    managedReleasesCount: managedReleases.length,
    distributedReleasesCount: results.length,
    kpis: aggregated.kpis,
    metrics: aggregated.metrics,
    topStores: aggregated.topStores,
    topReleases: aggregated.topReleases,
    freshness: aggregated.freshness,
    notice:
      results.length === 0 && notDistributedCount > 0
        ? "Zedbute-managed ONCE releases have not completed store distribution yet."
        : undefined,
  };
}
