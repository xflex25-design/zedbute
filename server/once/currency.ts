/**
 * Zedbute Background Currency Management & Financial Ledger
 * Features robust 24-hour TTL caching, persistent store caching,
 * fallback safety, and monthly ZMW/USD financial trend aggregation for Recharts data visualization.
 */

import { onceStore } from "./store";

export interface ExchangeRateInfo {
  rate: number; // e.g. 25.0 ZMW per 1 USD
  date: string; // ISO date string
  source: string;
  cachedAt?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours caching to minimize external API calls

let memoryCache: ExchangeRateInfo | null = null;
let lastFetchTimestamp = 0;

export async function getZmwUsdExchangeRate(forceRefresh = false): Promise<ExchangeRateInfo> {
  const now = Date.now();

  // 1. Check in-memory TTL cache
  if (!forceRefresh && memoryCache && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return memoryCache;
  }

  // 2. Check persistent store cache if not forced
  if (!forceRefresh) {
    try {
      const storedSettings = onceStore.getSettings() as any;
      if (storedSettings?.cached_exchange_rate && storedSettings?.exchange_rate_updated_at) {
        const storedTime = new Date(storedSettings.exchange_rate_updated_at).getTime();
        if (!Number.isNaN(storedTime) && now - storedTime < CACHE_TTL_MS) {
          memoryCache = {
            rate: Number(storedSettings.cached_exchange_rate),
            date: storedSettings.exchange_rate_date || new Date().toISOString().slice(0, 10),
            source: storedSettings.exchange_rate_source || "persistent_store_cache",
            cachedAt: storedSettings.exchange_rate_updated_at,
          };
          lastFetchTimestamp = storedTime;
          return memoryCache;
        }
      }
    } catch {
      // ignore store read errors
    }
  }

  // 3. Fetch fresh rate from external reliable provider
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      const zmwRate = data?.rates?.ZMW;
      if (typeof zmwRate === "number" && zmwRate > 0) {
        const info: ExchangeRateInfo = {
          rate: Number(zmwRate.toFixed(4)),
          date: new Date().toISOString().slice(0, 10),
          source: "live_exchangerate_api_cached",
          cachedAt: new Date().toISOString(),
        };

        memoryCache = info;
        lastFetchTimestamp = now;

        try {
          onceStore.updateSettings({
            ...(onceStore.getSettings() as any),
            cached_exchange_rate: info.rate,
            exchange_rate_date: info.date,
            exchange_rate_source: info.source,
            exchange_rate_updated_at: info.cachedAt,
          } as any);
        } catch {
          // ignore
        }

        return info;
      }
    }
  } catch {
    // API failed, fallback to stale memory cache or persistent cache
  }

  if (memoryCache) {
    return memoryCache;
  }

  try {
    const storedSettings = onceStore.getSettings() as any;
    if (storedSettings?.cached_exchange_rate) {
      memoryCache = {
        rate: Number(storedSettings.cached_exchange_rate),
        date: storedSettings.exchange_rate_date || new Date().toISOString().slice(0, 10),
        source: "stale_fallback_cache",
      };
      return memoryCache;
    }
  } catch {
    // ignore
  }

  // 4. Ultimate fallback default exchange rate: 25 ZMW = 1 USD
  memoryCache = {
    rate: 25.0,
    date: new Date().toISOString().slice(0, 10),
    source: "default_fallback",
  };
  lastFetchTimestamp = now;
  return memoryCache;
}

export interface MonthlyFinancialTrend {
  month: string;
  revenueZmw: number;
  estimatedUsd: number;
  onceExpensesUsd: number;
  netProfitZmw: number;
  netProfitUsd: number;
}

export interface FinancialSummary {
  totalRevenueZmw: number;
  estimatedUsdEquivalent: number;
  exchangeRateUsed: number;
  exchangeRateDate: string;
  exchangeRateSource: string;
  actualOnceExpensesUsd: number;
  lencoFeesZmw: number;
  lencoFeesUsd: number;
  netProfitZmw: number;
  netProfitUsd: number;
  remainingOnceCredits: number | null;
  lowCreditWarning: boolean;
  monthlyTrends: MonthlyFinancialTrend[];
}

export async function calculateZedbuteFinancialSummary(releases: Array<{
  status?: string;
  release_type?: string;
  credit_cost?: number;
  credits_debited?: number;
  is_ai_detected?: boolean;
  submitted_at?: string;
  created_at?: string;
}>, creditBalance: number | null): Promise<FinancialSummary> {
  const ex = await getZmwUsdExchangeRate();
  const rate = ex.rate;

  let totalRevenueZmw = 0;
  let actualOnceExpensesUsd = 0;
  const monthlyMap = new Map<string, { monthKey: string; revenueZmw: number; expensesUsd: number }>();

  for (const r of releases) {
    const status = (r.status || "").toLowerCase();
    if (status !== "draft" && status !== "unpaid") {
      const type = (r.release_type || "single").toLowerCase();
      const zmwPrice = type === "album" ? 500 : type === "ep" ? 200 : 70;
      totalRevenueZmw += zmwPrice;

      const debited = r.credits_debited ?? r.credit_cost ?? (r.is_ai_detected ? 2 : 1);
      const onceCost = Number(debited);
      actualOnceExpensesUsd += onceCost;

      const dateStr = r.submitted_at || r.created_at || new Date().toISOString();
      const d = new Date(dateStr);
      const monthKey = !Number.isNaN(d.getTime())
        ? `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`
        : "Recent";

      let entry = monthlyMap.get(monthKey);
      if (!entry) {
        entry = { monthKey, revenueZmw: 0, expensesUsd: 0 };
        monthlyMap.set(monthKey, entry);
      }
      entry.revenueZmw += zmwPrice;
      entry.expensesUsd += onceCost;
    }
  }

  const monthlyTrends: MonthlyFinancialTrend[] = Array.from(monthlyMap.values()).map((m) => {
    const lencoZmw = Math.round(m.revenueZmw * 0.025 * 100) / 100;
    const lencoUsd = Math.round((lencoZmw / rate) * 100) / 100;
    const estUsd = Math.round((m.revenueZmw / rate) * 100) / 100;
    const netZmw = Math.round((m.revenueZmw - lencoZmw - (m.expensesUsd * rate)) * 100) / 100;
    const netUsd = Math.round((estUsd - lencoUsd - m.expensesUsd) * 100) / 100;
    return {
      month: m.monthKey,
      revenueZmw: m.revenueZmw,
      estimatedUsd: estUsd,
      onceExpensesUsd: m.expensesUsd,
      netProfitZmw: netZmw,
      netProfitUsd: netUsd,
    };
  });

  // Lenco transaction fee assumption: ~2.5% of total revenue in ZMW
  const lencoFeesZmw = Math.round(totalRevenueZmw * 0.025 * 100) / 100;
  const lencoFeesUsd = Math.round((lencoFeesZmw / rate) * 100) / 100;

  const estimatedUsdEquivalent = Math.round((totalRevenueZmw / rate) * 100) / 100;

  const netRevenueZmw = totalRevenueZmw - lencoFeesZmw;
  const netProfitZmw = Math.round((netRevenueZmw - (actualOnceExpensesUsd * rate)) * 100) / 100;
  const netProfitUsd = Math.round((estimatedUsdEquivalent - lencoFeesUsd - actualOnceExpensesUsd) * 100) / 100;

  const remainingOnceCredits = creditBalance !== null && !Number.isNaN(creditBalance) ? creditBalance : null;
  const lowCreditWarning = remainingOnceCredits !== null && remainingOnceCredits < 10;

  return {
    totalRevenueZmw,
    estimatedUsdEquivalent,
    exchangeRateUsed: rate,
    exchangeRateDate: ex.date,
    exchangeRateSource: ex.source,
    actualOnceExpensesUsd,
    lencoFeesZmw,
    lencoFeesUsd,
    netProfitZmw,
    netProfitUsd,
    remainingOnceCredits,
    lowCreditWarning,
    monthlyTrends,
  };
}
