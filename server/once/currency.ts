/**
 * ZedBute Currency Management & Financial Accounting Ledger
 * Integrates Freecurrencyapi (ZMW -> USD) with:
 * - Strict server-side FREECURRENCY_API_KEY via `apikey` header
 * - 24-hour in-memory and persistent cache
 * - Explicit stale-cache warning on API unavailability (never silently assumes a rate)
 * - Per-transaction locked historical exchange-rate snapshots
 */

import { onceStore } from "./store";
import type {
  ExchangeRateResolution,
  ExchangeRateSnapshot,
  FinancialSummary,
  MonthlyFinancialTrend,
  OnceDistributionReleaseRecord,
  ZedbuteFinancialTransactionRecord,
} from "./types";

const FREECURRENCY_API_URL =
  "https://api.freecurrencyapi.com/v1/latest?base_currency=ZMW&currencies=USD";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const LENCO_PROCESSING_FEE_RATE = 0.025; // 2.5% Lenco fee
export const ZEDBUTE_SINGLE_PRICE_ZMW = 70;

let memoryCache: ExchangeRateSnapshot | null = null;
let lastFetchTimestamp = 0;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function resetCurrencyCacheForTests(): void {
  memoryCache = null;
  lastFetchTimestamp = 0;
}

export function convertZmwToUsd(amountZmw: number, zmwToUsdRate: number): number {
  return roundCurrency(amountZmw * zmwToUsdRate);
}

export function convertUsdToZmw(amountUsd: number, zmwToUsdRate: number): number {
  if (zmwToUsdRate <= 0) return 0;
  return roundCurrency(amountUsd / zmwToUsdRate);
}

function readPersistentCachedRate(): ExchangeRateSnapshot | null {
  try {
    const directCache = onceStore.getExchangeRateCache();
    if (
      directCache &&
      typeof directCache.zmwToUsdRate === "number" &&
      Number.isFinite(directCache.zmwToUsdRate) &&
      directCache.zmwToUsdRate > 0 &&
      directCache.fetchedAt
    ) {
      return directCache;
    }

    const storedSettings = onceStore.getSettings();
    if (
      typeof storedSettings?.cached_zmw_to_usd_rate === "number" &&
      Number.isFinite(storedSettings.cached_zmw_to_usd_rate) &&
      storedSettings.cached_zmw_to_usd_rate > 0 &&
      storedSettings.exchange_rate_updated_at
    ) {
      const zmwToUsdRate = storedSettings.cached_zmw_to_usd_rate;
      return {
        baseCurrency: "ZMW",
        targetCurrency: "USD",
        zmwToUsdRate,
        usdToZmwRate:
          typeof storedSettings.cached_usd_to_zmw_rate === "number" &&
          storedSettings.cached_usd_to_zmw_rate > 0
            ? storedSettings.cached_usd_to_zmw_rate
            : Number((1 / zmwToUsdRate).toFixed(6)),
        rateDate:
          storedSettings.exchange_rate_date ||
          storedSettings.exchange_rate_updated_at.slice(0, 10),
        fetchedAt: storedSettings.exchange_rate_updated_at,
        source: "freecurrencyapi_cache",
        isStale: false,
      };
    }
  } catch {
    // Ignore store read failures cleanly
  }
  return null;
}

function resolveStaleFallback(reason: string): ExchangeRateResolution {
  const cached = memoryCache || readPersistentCachedRate();
  if (cached && cached.zmwToUsdRate > 0) {
    const staleSnapshot: ExchangeRateSnapshot = {
      ...cached,
      source: "freecurrencyapi_stale_cache",
      isStale: true,
      staleReason: reason,
    };
    memoryCache = staleSnapshot;
    return { available: true, ...staleSnapshot };
  }

  return {
    available: false,
    baseCurrency: "ZMW",
    targetCurrency: "USD",
    zmwToUsdRate: null,
    usdToZmwRate: null,
    rateDate: null,
    fetchedAt: null,
    source: "unavailable",
    isStale: false,
    staleReason: reason,
  };
}

export async function getZmwUsdExchangeRate(
  forceRefresh = false
): Promise<ExchangeRateResolution> {
  const now = Date.now();

  // 1. Check in-memory 24-hour cache (only reuse if previous entry was fresh, not stale fallback)
  if (
    !forceRefresh &&
    memoryCache &&
    !memoryCache.isStale &&
    now - lastFetchTimestamp < CACHE_TTL_MS
  ) {
    return {
      available: true,
      ...memoryCache,
      source: "freecurrencyapi_cache",
      isStale: false,
      staleReason: undefined,
    };
  }

  // 2. Check persistent 24-hour store cache
  if (!forceRefresh) {
    const persistent = readPersistentCachedRate();
    if (persistent && !persistent.isStale) {
      const fetchedTime = new Date(persistent.fetchedAt).getTime();
      if (!Number.isNaN(fetchedTime) && now - fetchedTime < CACHE_TTL_MS) {
        memoryCache = {
          ...persistent,
          source: "freecurrencyapi_cache",
          isStale: false,
          staleReason: undefined,
        };
        lastFetchTimestamp = fetchedTime;
        return { available: true, ...memoryCache };
      }
    }
  }

  // 3. Call Freecurrencyapi with strict server-side FREECURRENCY_API_KEY
  const apiKey = process.env.FREECURRENCY_API_KEY?.trim();
  if (!apiKey) {
    return resolveStaleFallback(
      "FREECURRENCY_API_KEY is not configured on the server. No silent fallback rate is assumed."
    );
  }

  try {
    const res = await fetch(FREECURRENCY_API_URL, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return resolveStaleFallback(
        `Freecurrencyapi returned HTTP ${res.status}. Using last cached rate if available.`
      );
    }

    const payload = (await res.json()) as { data?: { USD?: unknown } };
    const rawUsdRate = payload?.data?.USD;

    if (typeof rawUsdRate !== "number" || !Number.isFinite(rawUsdRate) || rawUsdRate <= 0) {
      return resolveStaleFallback(
        "Freecurrencyapi response did not include a valid positive ZMW -> USD rate."
      );
    }

    const nowIso = new Date(now).toISOString();
    const zmwToUsdRate = Number(rawUsdRate.toFixed(8));
    const usdToZmwRate = Number((1 / zmwToUsdRate).toFixed(6));

    const freshSnapshot: ExchangeRateSnapshot = {
      baseCurrency: "ZMW",
      targetCurrency: "USD",
      zmwToUsdRate,
      usdToZmwRate,
      rateDate: nowIso.slice(0, 10),
      fetchedAt: nowIso,
      source: "freecurrencyapi_live",
      isStale: false,
    };

    memoryCache = freshSnapshot;
    lastFetchTimestamp = now;

    try {
      onceStore.setExchangeRateCache(freshSnapshot);
    } catch {
      // Ignore persistent cache write failure; memory cache stays populated
    }

    return { available: true, ...freshSnapshot };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Network error reaching Freecurrencyapi";
    return resolveStaleFallback(
      `Freecurrencyapi unavailable (${message}). Using last cached rate if available.`
    );
  }
}

export function resolveReleaseZmwPrice(release: {
  release_type?: string;
  amount_zmw?: number;
}): number {
  if (
    typeof release.amount_zmw === "number" &&
    Number.isFinite(release.amount_zmw) &&
    release.amount_zmw > 0
  ) {
    return roundCurrency(release.amount_zmw);
  }
  const type = (release.release_type || "single").toLowerCase();
  if (type === "album") return 500;
  if (type === "ep") return 200;
  return ZEDBUTE_SINGLE_PRICE_ZMW;
}

export async function recordFinancialTransactionSnapshot(params: {
  transactionId: string;
  userId: string;
  releaseId?: string | null;
  onceReleaseId?: string | null;
  title?: string;
  paymentType: string;
  paymentGateway?: "lenco" | "zedbute_ledger";
  paymentStatus?: "verified" | "pending" | "recorded";
  amountZmw: number;
  processingFeeZmw?: number;
  onceExpenseUsd?: number;
  createdAt?: string;
}): Promise<ZedbuteFinancialTransactionRecord> {
  const rateResult = await getZmwUsdExchangeRate();
  const amountZmw = roundCurrency(params.amountZmw);
  const processingFeeZmw =
    typeof params.processingFeeZmw === "number" && Number.isFinite(params.processingFeeZmw)
      ? roundCurrency(params.processingFeeZmw)
      : roundCurrency(amountZmw * LENCO_PROCESSING_FEE_RATE);
  const onceExpenseUsd =
    typeof params.onceExpenseUsd === "number" && Number.isFinite(params.onceExpenseUsd)
      ? roundCurrency(params.onceExpenseUsd)
      : 0;

  let amountUsd: number | null = null;
  let processingFeeUsd: number | null = null;
  let onceExpenseZmw: number | null = null;
  let netProfitZmw: number | null = null;
  let netProfitUsd: number | null = null;

  if (rateResult.available) {
    amountUsd = convertZmwToUsd(amountZmw, rateResult.zmwToUsdRate);
    processingFeeUsd = convertZmwToUsd(processingFeeZmw, rateResult.zmwToUsdRate);
    onceExpenseZmw = convertUsdToZmw(onceExpenseUsd, rateResult.zmwToUsdRate);
    netProfitZmw = roundCurrency(amountZmw - processingFeeZmw - onceExpenseZmw);
    netProfitUsd = roundCurrency(amountUsd - processingFeeUsd - onceExpenseUsd);
  }

  return onceStore.upsertFinancialTransaction({
    transaction_id: params.transactionId,
    user_id: params.userId,
    release_id: params.releaseId ?? null,
    once_release_id: params.onceReleaseId ?? null,
    title: params.title,
    payment_type: params.paymentType,
    payment_gateway: params.paymentGateway || "lenco",
    payment_status: params.paymentStatus || "verified",
    amount_zmw: amountZmw,
    amount_usd: amountUsd,
    zmw_to_usd_rate: rateResult.available ? rateResult.zmwToUsdRate : null,
    usd_to_zmw_rate: rateResult.available ? rateResult.usdToZmwRate : null,
    exchange_rate_date: rateResult.available ? rateResult.rateDate : null,
    exchange_rate_fetched_at: rateResult.available ? rateResult.fetchedAt : null,
    exchange_rate_source: rateResult.source,
    exchange_rate_is_stale: rateResult.isStale,
    processing_fee_zmw: processingFeeZmw,
    processing_fee_usd: processingFeeUsd,
    once_expense_usd: onceExpenseUsd,
    once_expense_zmw: onceExpenseZmw,
    net_profit_zmw: netProfitZmw,
    net_profit_usd: netProfitUsd,
    created_at: params.createdAt,
  });
}

function getMonthKey(dateStr?: string): string {
  const d = new Date(dateStr || new Date().toISOString());
  if (Number.isNaN(d.getTime())) return "Recent";
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

export async function calculateZedbuteFinancialSummary(
  releases: Array<Partial<OnceDistributionReleaseRecord>>,
  creditBalance: number | null,
  recordedTransactions: ZedbuteFinancialTransactionRecord[] = [],
  forceRefreshRate = false
): Promise<FinancialSummary> {
  const ex = await getZmwUsdExchangeRate(forceRefreshRate);

  const ledgerRows: ZedbuteFinancialTransactionRecord[] = [...recordedTransactions];

  const trackedReleaseIds = new Set<string>();
  const trackedOnceIds = new Set<string>();
  for (const tx of recordedTransactions) {
    if (tx.release_id) trackedReleaseIds.add(tx.release_id);
    if (tx.once_release_id) trackedOnceIds.add(tx.once_release_id);
  }

  for (const r of releases) {
    const status = (r.status || "").toLowerCase();
    if (status === "draft" || status === "unpaid") continue;

    const alreadyTracked =
      (r.id && trackedReleaseIds.has(r.id)) ||
      (r.release_id && trackedReleaseIds.has(r.release_id)) ||
      (r.once_release_id && trackedOnceIds.has(r.once_release_id));

    if (alreadyTracked) continue;

    const amountZmw = resolveReleaseZmwPrice(r);
    const processingFeeZmw =
      typeof r.processing_fee_zmw === "number" && Number.isFinite(r.processing_fee_zmw)
        ? roundCurrency(r.processing_fee_zmw)
        : roundCurrency(amountZmw * LENCO_PROCESSING_FEE_RATE);
    const debited = r.credits_debited ?? r.credit_cost ?? (r.is_ai_detected ? 2 : 1);
    const onceExpenseUsd = roundCurrency(Number(debited) || 0);

    // Prefer the release's locked historical exchange rate snapshot; never alter historical records
    const snap = r.exchange_rate_snapshot;
    const rate =
      snap && typeof snap.zmwToUsdRate === "number" && snap.zmwToUsdRate > 0
        ? snap.zmwToUsdRate
        : ex.available
        ? ex.zmwToUsdRate
        : null;
    const usdToZmw =
      snap && typeof snap.usdToZmwRate === "number" && snap.usdToZmwRate > 0
        ? snap.usdToZmwRate
        : ex.available
        ? ex.usdToZmwRate
        : null;

    const amountUsd = rate !== null ? convertZmwToUsd(amountZmw, rate) : null;
    const processingFeeUsd = rate !== null ? convertZmwToUsd(processingFeeZmw, rate) : null;
    const onceExpenseZmw = rate !== null ? convertUsdToZmw(onceExpenseUsd, rate) : null;
    const netProfitZmw =
      onceExpenseZmw !== null
        ? roundCurrency(amountZmw - processingFeeZmw - onceExpenseZmw)
        : null;
    const netProfitUsd =
      amountUsd !== null && processingFeeUsd !== null
        ? roundCurrency(amountUsd - processingFeeUsd - onceExpenseUsd)
        : null;

    ledgerRows.push({
      id: r.id || `rel_${ledgerRows.length + 1}`,
      transaction_id: r.once_release_id || r.release_id || r.id || `rel_${ledgerRows.length + 1}`,
      user_id: r.user_id || "",
      release_id: r.release_id || r.id || null,
      once_release_id: r.once_release_id || null,
      title: r.title || "Music Release",
      payment_type: (r.release_type || "single").toLowerCase(),
      payment_gateway: "lenco",
      payment_status: "verified",
      amount_zmw: amountZmw,
      amount_usd: amountUsd,
      zmw_to_usd_rate: rate,
      usd_to_zmw_rate: usdToZmw,
      exchange_rate_date: snap?.rateDate ?? (ex.available ? ex.rateDate : null),
      exchange_rate_fetched_at: snap?.fetchedAt ?? (ex.available ? ex.fetchedAt : null),
      exchange_rate_source: snap?.source ?? ex.source,
      exchange_rate_is_stale: snap ? snap.isStale : ex.isStale,
      processing_fee_zmw: processingFeeZmw,
      processing_fee_usd: processingFeeUsd,
      once_expense_usd: onceExpenseUsd,
      once_expense_zmw: onceExpenseZmw,
      net_profit_zmw: netProfitZmw,
      net_profit_usd: netProfitUsd,
      created_at: r.submitted_at || r.created_at || new Date().toISOString(),
      updated_at: r.updated_at || r.submitted_at || r.created_at || new Date().toISOString(),
    });
  }

  let totalRevenueZmw = 0;
  let totalRevenueUsd = 0;
  let actualOnceExpensesUsd = 0;
  let actualOnceExpensesZmw = 0;
  let lencoFeesZmw = 0;
  let lencoFeesUsd = 0;
  let netProfitZmwTotal = 0;
  let netProfitUsdTotal = 0;
  let unconvertedTransactionsCount = 0;
  let anyRowUsedStaleRate = ex.isStale;

  const monthlyMap = new Map<
    string,
    {
      monthKey: string;
      revenueZmw: number;
      estimatedUsd: number;
      onceExpensesUsd: number;
      processingFeesZmw: number;
      processingFeesUsd: number;
      netProfitZmw: number;
      netProfitUsd: number;
      hasUnconverted: boolean;
    }
  >();

  for (const row of ledgerRows) {
    totalRevenueZmw += row.amount_zmw;
    lencoFeesZmw += row.processing_fee_zmw;
    actualOnceExpensesUsd += row.once_expense_usd;
    if (row.exchange_rate_is_stale) {
      anyRowUsedStaleRate = true;
    }

    const rowHasUsd =
      row.amount_usd !== null &&
      row.processing_fee_usd !== null &&
      row.once_expense_zmw !== null &&
      row.net_profit_zmw !== null &&
      row.net_profit_usd !== null;

    if (rowHasUsd) {
      totalRevenueUsd += row.amount_usd!;
      lencoFeesUsd += row.processing_fee_usd!;
      actualOnceExpensesZmw += row.once_expense_zmw!;
      netProfitZmwTotal += row.net_profit_zmw!;
      netProfitUsdTotal += row.net_profit_usd!;
    } else {
      unconvertedTransactionsCount++;
    }

    const monthKey = getMonthKey(row.created_at);
    let m = monthlyMap.get(monthKey);
    if (!m) {
      m = {
        monthKey,
        revenueZmw: 0,
        estimatedUsd: 0,
        onceExpensesUsd: 0,
        processingFeesZmw: 0,
        processingFeesUsd: 0,
        netProfitZmw: 0,
        netProfitUsd: 0,
        hasUnconverted: false,
      };
      monthlyMap.set(monthKey, m);
    }
    m.revenueZmw += row.amount_zmw;
    m.processingFeesZmw += row.processing_fee_zmw;
    m.onceExpensesUsd += row.once_expense_usd;
    if (rowHasUsd) {
      m.estimatedUsd += row.amount_usd!;
      m.processingFeesUsd += row.processing_fee_usd!;
      m.netProfitZmw += row.net_profit_zmw!;
      m.netProfitUsd += row.net_profit_usd!;
    } else {
      m.hasUnconverted = true;
    }
  }

  const monthlyTrends: MonthlyFinancialTrend[] = Array.from(monthlyMap.values()).map((m) => ({
    month: m.monthKey,
    revenueZmw: roundCurrency(m.revenueZmw),
    estimatedUsd: m.hasUnconverted ? null : roundCurrency(m.estimatedUsd),
    onceExpensesUsd: roundCurrency(m.onceExpensesUsd),
    processingFeesZmw: roundCurrency(m.processingFeesZmw),
    processingFeesUsd: m.hasUnconverted ? null : roundCurrency(m.processingFeesUsd),
    netProfitZmw: m.hasUnconverted ? null : roundCurrency(m.netProfitZmw),
    netProfitUsd: m.hasUnconverted ? null : roundCurrency(m.netProfitUsd),
  }));

  const hasMissingRateData = unconvertedTransactionsCount > 0;
  const remainingOnceCredits =
    creditBalance !== null && !Number.isNaN(creditBalance) ? creditBalance : null;
  const lowCreditWarning = remainingOnceCredits !== null && remainingOnceCredits < 10;

  const recentTransactions = [...ledgerRows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 25);

  return {
    totalRevenueZmw: roundCurrency(totalRevenueZmw),
    estimatedUsdEquivalent: hasMissingRateData ? null : roundCurrency(totalRevenueUsd),
    zmwToUsdRate: ex.available ? ex.zmwToUsdRate : null,
    exchangeRateUsed: ex.available ? ex.usdToZmwRate : null,
    exchangeRateDate: ex.available ? ex.rateDate : null,
    exchangeRateFetchedAt: ex.available ? ex.fetchedAt : null,
    exchangeRateSource: ex.source,
    isStale: anyRowUsedStaleRate,
    rateUnavailable: !ex.available || hasMissingRateData,
    staleReason: ex.staleReason || null,
    actualOnceExpensesUsd: roundCurrency(actualOnceExpensesUsd),
    actualOnceExpensesZmw: hasMissingRateData ? null : roundCurrency(actualOnceExpensesZmw),
    lencoFeesZmw: roundCurrency(lencoFeesZmw),
    lencoFeesUsd: hasMissingRateData ? null : roundCurrency(lencoFeesUsd),
    netProfitZmw: hasMissingRateData ? null : roundCurrency(netProfitZmwTotal),
    netProfitUsd: hasMissingRateData ? null : roundCurrency(netProfitUsdTotal),
    remainingOnceCredits,
    lowCreditWarning,
    transactionsCount: ledgerRows.length,
    unconvertedTransactionsCount,
    recentTransactions,
    monthlyTrends,
  };
}
