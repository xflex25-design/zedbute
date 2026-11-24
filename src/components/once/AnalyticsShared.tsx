import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  AnalyticsDatePreset,
  OnceDailyMetric,
  OnceFreshnessMetadata,
  OncePerformanceKpis,
  OnceStoreMetric,
} from "../../../server/once/types";

export const DATE_PRESETS: Array<{ value: Exclude<AnalyticsDatePreset, "custom">; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "Not yet synced";
  const parsed = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatSyncTimestamp(isoTs: string | null | undefined): string {
  if (!isoTs) return "Not yet synced";
  const parsed = new Date(isoTs);
  if (Number.isNaN(parsed.getTime())) return isoTs;
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function AnalyticsDateFilterBar({
  preset,
  customFrom,
  customTo,
  minAllowedDate,
  maxAllowedDate,
  loading,
  dateError,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
  onRefresh,
}: {
  preset: AnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  minAllowedDate: string;
  maxAllowedDate: string;
  loading: boolean;
  dateError?: string | null;
  onPresetChange: (preset: AnalyticsDatePreset) => void;
  onCustomFromChange: (val: string) => void;
  onCustomToChange: (val: string) => void;
  onApplyCustom: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.value}
              type="button"
              size="sm"
              variant={preset === p.value ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => onPresetChange(p.value)}
              disabled={loading}
            >
              {p.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={preset === "custom" ? "default" : "outline"}
            className="h-8 text-xs gap-1"
            onClick={() => onPresetChange("custom")}
            disabled={loading}
          >
            <Calendar className="h-3.5 w-3.5" />
            Custom
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {preset === "custom" && (
        <div className="p-3 rounded-lg border border-border bg-muted/20 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              From Date
            </label>
            <Input
              type="date"
              value={customFrom}
              min={minAllowedDate}
              max={customTo || maxAllowedDate}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="h-8 text-xs w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              To Date
            </label>
            <Input
              type="date"
              value={customTo}
              min={customFrom || minAllowedDate}
              max={maxAllowedDate}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="h-8 text-xs w-40"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={onApplyCustom}
            disabled={loading}
          >
            Apply Range
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Historical reporting window is limited to 2 years ({minAllowedDate} to {maxAllowedDate}).
          </p>
        </div>
      )}

      {dateError && (
        <p className="text-xs text-destructive font-medium">{dateError}</p>
      )}
    </div>
  );
}

export function AnalyticsKpiCards({
  kpis,
  fromDate,
  toDate,
}: {
  kpis: OncePerformanceKpis;
  fromDate: string;
  toDate: string;
}) {
  const growth = kpis.periodChangePct;
  const hasGrowth = growth !== null && growth !== undefined;
  const isPositive = hasGrowth && growth >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <Card className="bg-card border-border">
        <CardHeader className="p-4 pb-1.5">
          <CardDescription className="text-xs">Total Streams & Views</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {formatNumber(kpis.totalStreams)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
          {formatDateLabel(fromDate)} – {formatDateLabel(toDate)}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="p-4 pb-1.5">
          <CardDescription className="text-xs">Average Daily Streams</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {kpis.avgDailyStreams.toFixed(1)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
          Store streams + YouTube Music views / day
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="p-4 pb-1.5">
          <CardDescription className="text-xs">Streaming Growth</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight flex items-center gap-1.5">
            {hasGrowth ? (
              <>
                <span className={isPositive ? "text-foreground" : "text-muted-foreground"}>
                  {isPositive ? "+" : ""}
                  {growth.toFixed(1)}%
                </span>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-foreground" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-lg">No prior data</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
          vs. preceding period of equal length
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="p-4 pb-1.5">
          <CardDescription className="text-xs">Top Streaming Platform</CardDescription>
          <CardTitle className="text-xl font-bold tracking-tight truncate">
            {kpis.topStore ? kpis.topStore.name : "No store data"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
          {kpis.topStore
            ? `${(kpis.topStore.share * 100).toFixed(1)}% share of reported streams`
            : "Awaiting store reports"}
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsFreshnessNotice({
  freshness,
}: {
  freshness: OnceFreshnessMetadata | null;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 p-3.5 text-xs space-y-2">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">
            Reporting Freshness & Store Delay Notice
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Streaming figures are synchronized periodically from DSP store analytics (hourly) and YouTube Music view snapshots (weekly/bi-weekly). Totals reflect reported store activity rather than real-time counts and may not include the most recent day(s).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
        <div className="rounded border border-border/60 bg-background/70 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Latest Fully Reported Store Date
          </div>
          <div className="font-semibold mt-0.5">
            {formatDateLabel(freshness?.storesThrough)}
          </div>
        </div>
        <div className="rounded border border-border/60 bg-background/70 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Last Store Synchronization
          </div>
          <div className="font-semibold mt-0.5">
            {formatSyncTimestamp(freshness?.storesSyncedAt)}
          </div>
        </div>
        <div className="rounded border border-border/60 bg-background/70 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Latest YouTube Music Snapshot
          </div>
          <div className="font-semibold mt-0.5">
            {formatDateLabel(freshness?.youtubeLatestSnapshot)}
          </div>
        </div>
        <div className="rounded border border-border/60 bg-background/70 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Last YouTube Music Sync
          </div>
          <div className="font-semibold mt-0.5">
            {formatSyncTimestamp(freshness?.youtubeSyncedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailyStreamsChartCard({
  title = "Daily Streaming History",
  subtitle,
  metrics,
}: {
  title?: string;
  subtitle?: string;
  metrics: OnceDailyMetric[];
}) {
  const chartData = metrics.map((m) => ({
    date: m.eventDate,
    label: formatDateLabel(m.eventDate),
    streams: m.streamsCount,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        {subtitle && <CardDescription className="text-xs">{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="zedbuteStreamsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => String(v).slice(5)}
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11 }} width={48} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                  formatter={(value: number) => [formatNumber(value), "Streams & Views"]}
                />
                <Area
                  type="monotone"
                  dataKey="streams"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#zedbuteStreamsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            No daily stream readings reported for this window.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StoreBreakdownCard({
  stores,
  totalStreams,
  title = "Store Breakdown",
}: {
  stores: OnceStoreMetric[];
  totalStreams: number;
  title?: string;
}) {
  const topChartStores = stores.slice(0, 8);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-[11px]">
            {stores.length} stores
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Distribution of streams and YouTube Music views across DSPs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stores.length > 0 ? (
          <>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topChartStores}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 10, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatNumber(value), "Streams / Views"]}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {stores.map((store) => {
                const sharePct =
                  totalStreams > 0 ? ((store.total / totalStreams) * 100).toFixed(1) : "0.0";
                return (
                  <div
                    key={store.id}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded border border-border/50 bg-muted/15"
                  >
                    <span className="font-medium truncate pr-2">{store.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">{sharePct}%</span>
                      <span className="font-semibold tabular-nums">
                        {formatNumber(store.total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            No store-level streams reported in this date range.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
