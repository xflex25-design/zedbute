import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { onceApi } from "@/services/onceApi";
import {
  AnalyticsDateFilterBar,
  AnalyticsFreshnessNotice,
  AnalyticsKpiCards,
  DailyStreamsChartCard,
  StoreBreakdownCard,
  formatNumber,
} from "./AnalyticsShared";
import { AlertCircle, BarChart3, Disc, Loader2, Music, Radio, Users } from "lucide-react";
import type {
  AnalyticsDatePreset,
  ZedbuteAdminAnalyticsPayload,
} from "../../../server/once/types";

function getDefaultCustomDates() {
  const now = new Date();
  const max = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const min = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(max.getTime() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    minAllowedDate: min.toISOString().slice(0, 10),
    maxAllowedDate: max.toISOString().slice(0, 10),
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function AdminAnalyticsSection() {
  const defaults = useMemo(() => getDefaultCustomDates(), []);

  const [preset, setPreset] = useState<AnalyticsDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState(defaults.from);
  const [customTo, setCustomTo] = useState(defaults.to);
  const [appliedCustom, setAppliedCustom] = useState<{ fromDate: string; toDate: string }>({
    fromDate: defaults.from,
    toDate: defaults.to,
  });
  const [dateError, setDateError] = useState<string | null>(null);

  const [data, setData] = useState<ZedbuteAdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const minAllowedDate = data?.minAllowedDate || defaults.minAllowedDate;
  const maxAllowedDate = data?.maxAllowedDate || defaults.maxAllowedDate;

  const loadAdminAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        preset === "custom"
          ? {
              range: "custom" as const,
              fromDate: appliedCustom.fromDate,
              toDate: appliedCustom.toDate,
            }
          : { range: preset };
      const res = await onceApi.getAdminAnalyticsSummary(params);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load admin streaming analytics");
    } finally {
      setLoading(false);
    }
  }, [preset, appliedCustom]);

  useEffect(() => {
    loadAdminAnalytics();
  }, [loadAdminAnalytics]);

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) {
      setDateError("Please select both start and end dates.");
      return;
    }
    if (customFrom > customTo) {
      setDateError("Start date cannot be after end date.");
      return;
    }
    if (customFrom < minAllowedDate) {
      setDateError(`Historical data is limited to 2 years (earliest: ${minAllowedDate}).`);
      return;
    }
    if (customTo > maxAllowedDate) {
      setDateError(`End date cannot exceed ${maxAllowedDate}.`);
      return;
    }
    setDateError(null);
    setAppliedCustom({ fromDate: customFrom, toDate: customTo });
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Zedbute Admin Streaming Analytics
            </CardTitle>
            <CardDescription className="text-xs">
              Aggregated ONCE streaming performance strictly scoped to Zedbute-managed artists and releases
            </CardDescription>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <Users className="h-3 w-3" />
                {data.managedArtistsCount} Managed Artists
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {data.distributedReleasesCount} / {data.managedReleasesCount} Distributed Releases
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <AnalyticsDateFilterBar
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          minAllowedDate={minAllowedDate}
          maxAllowedDate={maxAllowedDate}
          loading={loading}
          dateError={dateError}
          onPresetChange={(p) => {
            setDateError(null);
            setPreset(p);
          }}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onApplyCustom={handleApplyCustom}
          onRefresh={loadAdminAnalytics}
        />

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Aggregating Zedbute-managed release analytics from ONCE...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Unable to load admin analytics</p>
              <p className="text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
        ) : data ? (
          <>
            {data.notice && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Radio className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{data.notice}</p>
              </div>
            )}

            <AnalyticsKpiCards
              kpis={data.kpis}
              fromDate={data.fromDate}
              toDate={data.toDate}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <DailyStreamsChartCard
                  title="Zedbute Catalogue Daily Streams"
                  subtitle="Aggregated across Zedbute-managed ONCE releases only"
                  metrics={data.metrics}
                />
              </div>
              <StoreBreakdownCard
                title="Managed Store Breakdown"
                stores={data.topStores}
                totalStreams={data.kpis.totalStreams}
              />
            </div>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Disc className="h-4 w-4 text-primary" />
                  Top Zedbute-Managed Releases
                </CardTitle>
                <CardDescription className="text-xs">
                  Performance ranking across releases managed through Zedbute
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topReleases.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Release</TableHead>
                          <TableHead>Artist</TableHead>
                          <TableHead className="text-right">Store Streams</TableHead>
                          <TableHead className="text-right">YouTube Views</TableHead>
                          <TableHead className="text-right">Total Streams</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topReleases.map((rel) => (
                          <TableRow key={rel.releaseId}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                {rel.coverArtFileUrl ? (
                                  <img
                                    src={rel.coverArtFileUrl}
                                    alt={rel.title}
                                    className="w-8 h-8 rounded object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                    <Music className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="font-medium text-sm">{rel.title}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {rel.primaryArtistName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(rel.storeStreams)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(rel.youtubeViews)}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatNumber(rel.streamsCount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                    No Zedbute-managed streaming totals reported in this window yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <AnalyticsFreshnessNotice freshness={data.freshness} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
