import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExchangeRateSnapshot,
  OnceEngineSettingsRecord,
  ZedbuteFinancialTransactionRecord,
} from "./types";

const mockState = vi.hoisted(() => ({
  exchangeRateCache: null as ExchangeRateSnapshot | null,
  transactions: [] as ZedbuteFinancialTransactionRecord[],
  settings: {
    id: "default",
    auto_distribute_default: false,
    require_admin_approval: true,
    single_upload_price_zmw: 70,
    updated_at: "2026-11-24T00:00:00.000Z",
  } as OnceEngineSettingsRecord,
}));

vi.mock("./store", () => ({
  onceStore: {
    getExchangeRateCache: () => mockState.exchangeRateCache,
    setExchangeRateCache: (snap: ExchangeRateSnapshot) => {
      mockState.exchangeRateCache = snap;
      mockState.settings = {
        ...mockState.settings,
        cached_zmw_to_usd_rate: snap.zmwToUsdRate,
        cached_usd_to_zmw_rate: snap.usdToZmwRate,
        exchange_rate_date: snap.rateDate,
        exchange_rate_source: snap.source,
        exchange_rate_updated_at: snap.fetchedAt,
      };
      return snap;
    },
    getSettings: () => mockState.settings,
    listFinancialTransactions: () => [...mockState.transactions],
    upsertFinancialTransaction: (
      tx: Omit<ZedbuteFinancialTransactionRecord, "id" | "created_at" | "updated_at"> & {
        id?: string;
        created_at?: string;
      }
    ) => {
      const idx = mockState.transactions.findIndex(
        (t) =>
          t.transaction_id === tx.transaction_id ||
          (tx.release_id && t.release_id === tx.release_id)
      );
      const now = new Date().toISOString();
      if (idx >= 0) {
        const prev = mockState.transactions[idx];
        const merged: ZedbuteFinancialTransactionRecord = {
          ...prev,
          ...tx,
          id: prev.id,
          transaction_id: prev.transaction_id,
          zmw_to_usd_rate: prev.zmw_to_usd_rate !== null ? prev.zmw_to_usd_rate : tx.zmw_to_usd_rate,
          usd_to_zmw_rate: prev.usd_to_zmw_rate !== null ? prev.usd_to_zmw_rate : tx.usd_to_zmw_rate,
          amount_usd: prev.zmw_to_usd_rate !== null ? prev.amount_usd : tx.amount_usd,
          processing_fee_usd: prev.zmw_to_usd_rate !== null ? prev.processing_fee_usd : tx.processing_fee_usd,
          once_expense_usd: Math.max(prev.once_expense_usd || 0, tx.once_expense_usd || 0),
          created_at: prev.created_at,
          updated_at: now,
        };
        if (merged.zmw_to_usd_rate && merged.zmw_to_usd_rate > 0) {
          const onceZmw = Math.round((merged.once_expense_usd / merged.zmw_to_usd_rate) * 100) / 100;
          merged.once_expense_zmw = onceZmw;
          merged.net_profit_zmw =
            Math.round((merged.amount_zmw - merged.processing_fee_zmw - onceZmw) * 100) / 100;
          merged.net_profit_usd =
            merged.amount_usd !== null && merged.processing_fee_usd !== null
              ? Math.round((merged.amount_usd - merged.processing_fee_usd - merged.once_expense_usd) * 100) / 100
              : null;
        }
        mockState.transactions[idx] = merged;
        return merged;
      }
      const created: ZedbuteFinancialTransactionRecord = {
        ...tx,
        id: tx.id || `tx_${mockState.transactions.length + 1}`,
        created_at: tx.created_at || now,
        updated_at: now,
      };
      mockState.transactions.unshift(created);
      return created;
    },
  },
}));

import {
  calculateZedbuteFinancialSummary,
  getZmwUsdExchangeRate,
  recordFinancialTransactionSnapshot,
  resetCurrencyCacheForTests,
  ZEDBUTE_SINGLE_PRICE_ZMW,
} from "./currency";

describe("Freecurrencyapi ZedBute Currency & Financial Ledger", () => {
  const originalEnvKey = process.env.FREECURRENCY_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T10:00:00.000Z"));
    resetCurrencyCacheForTests();
    mockState.exchangeRateCache = null;
    mockState.transactions = [];
    mockState.settings = {
      id: "default",
      auto_distribute_default: false,
      require_admin_approval: true,
      single_upload_price_zmw: 70,
      updated_at: "2026-11-24T00:00:00.000Z",
    };
    process.env.FREECURRENCY_API_KEY = "test_fca_secret_key";
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    if (originalEnvKey === undefined) {
      delete process.env.FREECURRENCY_API_KEY;
    } else {
      process.env.FREECURRENCY_API_KEY = originalEnvKey;
    }
  });

  it("queries Freecurrencyapi with base_currency=ZMW&currencies=USD and apikey header, and caches for 24 hours", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { USD: 0.04 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = await getZmwUsdExchangeRate();
    expect(first.available).toBe(true);
    if (first.available) {
      expect(first.zmwToUsdRate).toBe(0.04);
      expect(first.usdToZmwRate).toBe(25);
      expect(first.source).toBe("freecurrencyapi_live");
      expect(first.isStale).toBe(false);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.freecurrencyapi.com/v1/latest?base_currency=ZMW&currencies=USD");
    expect((init as RequestInit).headers).toMatchObject({ apikey: "test_fca_secret_key" });

    // Within 24h: uses cache, zero extra API calls
    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    const second = await getZmwUsdExchangeRate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.available).toBe(true);
    if (second.available) {
      expect(second.source).toBe("freecurrencyapi_cache");
      expect(second.isStale).toBe(false);
    }

    // After 24h: fetches fresh rate
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    const third = await getZmwUsdExchangeRate();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(third.available).toBe(true);
  });

  it("never silently assumes an exchange rate when API fails and no cache exists", async () => {
    delete process.env.FREECURRENCY_API_KEY;

    const rate = await getZmwUsdExchangeRate();
    expect(rate.available).toBe(false);
    expect(rate.zmwToUsdRate).toBeNull();
    expect(rate.usdToZmwRate).toBeNull();
    expect(rate.source).toBe("unavailable");

    const summary = await calculateZedbuteFinancialSummary(
      [{ id: "r1", status: "processing", release_type: "single", credit_cost: 1 }],
      5
    );
    expect(summary.totalRevenueZmw).toBe(ZEDBUTE_SINGLE_PRICE_ZMW);
    expect(summary.estimatedUsdEquivalent).toBeNull();
    expect(summary.netProfitZmw).toBeNull();
    expect(summary.netProfitUsd).toBeNull();
    expect(summary.actualOnceExpensesUsd).toBe(1);
    expect(summary.rateUnavailable).toBe(true);
    expect(summary.remainingOnceCredits).toBe(5);
  });

  it("falls back to last cached rate and flags as stale when Freecurrencyapi becomes unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { USD: 0.04 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await getZmwUsdExchangeRate();

    // Advance past 24h TTL and force/trigger refresh when API is down
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    const stale = await getZmwUsdExchangeRate();
    expect(stale.available).toBe(true);
    expect(stale.isStale).toBe(true);
    expect(stale.source).toBe("freecurrencyapi_stale_cache");
    if (stale.available) {
      expect(stale.zmwToUsdRate).toBe(0.04);
    }
    expect(stale.staleReason).toContain("503");
  });

  it("preserves historical per-transaction exchange rates when rates fluctuate and calculates K70 revenue, fees, ONCE expenses, and net profit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { USD: 0.04 } }), // 1 ZMW = $0.04 (1 USD = K25)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { USD: 0.05 } }), // 1 ZMW = $0.05 (1 USD = K20)
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    // Day 1: Customer pays K70 via Lenco, release uses 1 ONCE credit ($1 USD)
    const tx1 = await recordFinancialTransactionSnapshot({
      transactionId: "lenco_tx_day1",
      userId: "user_1",
      releaseId: "rel_1",
      title: "Track One",
      paymentType: "release",
      amountZmw: 70,
      onceExpenseUsd: 1,
    });

    expect(tx1.amount_zmw).toBe(70);
    expect(tx1.zmw_to_usd_rate).toBe(0.04);
    expect(tx1.amount_usd).toBe(2.8);
    expect(tx1.processing_fee_zmw).toBe(1.75);
    expect(tx1.processing_fee_usd).toBe(0.07);
    expect(tx1.once_expense_usd).toBe(1);
    expect(tx1.once_expense_zmw).toBe(25);
    expect(tx1.net_profit_zmw).toBe(43.25);
    expect(tx1.net_profit_usd).toBe(1.73);

    // Day 2 (>24h later): Exchange rate shifts to 0.05
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    const tx2 = await recordFinancialTransactionSnapshot({
      transactionId: "lenco_tx_day2",
      userId: "user_2",
      releaseId: "rel_2",
      title: "Track Two",
      paymentType: "release",
      amountZmw: 70,
      onceExpenseUsd: 2, // AI song = $2 ONCE credits
    });

    expect(tx2.zmw_to_usd_rate).toBe(0.05);
    expect(tx2.amount_usd).toBe(3.5);
    expect(tx2.processing_fee_zmw).toBe(1.75);
    expect(tx2.processing_fee_usd).toBe(0.09);
    expect(tx2.once_expense_usd).toBe(2);
    expect(tx2.once_expense_zmw).toBe(40);
    expect(tx2.net_profit_zmw).toBe(28.25);
    expect(tx2.net_profit_usd).toBe(1.41);

    // Financial summary aggregates both using each transaction's locked historical rate
    const summary = await calculateZedbuteFinancialSummary(
      [],
      42,
      mockState.transactions
    );

    expect(summary.totalRevenueZmw).toBe(140);
    expect(summary.estimatedUsdEquivalent).toBe(6.3); // $2.80 + $3.50 (Day 1 did NOT change!)
    expect(summary.actualOnceExpensesUsd).toBe(3); // $1 + $2
    expect(summary.actualOnceExpensesZmw).toBe(65); // K25 + K40
    expect(summary.lencoFeesZmw).toBe(3.5); // K1.75 + K1.75
    expect(summary.lencoFeesUsd).toBe(0.16); // $0.07 + $0.09
    expect(summary.netProfitZmw).toBe(71.5); // K43.25 + K28.25
    expect(summary.netProfitUsd).toBe(3.14); // $1.73 + $1.41
    expect(summary.remainingOnceCredits).toBe(42);
    expect(summary.isStale).toBe(false);
    expect(summary.rateUnavailable).toBe(false);
  });
});
