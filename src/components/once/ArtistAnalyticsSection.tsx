import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  AlertCircle,
  BarChart3,
  Disc,
  Loader2,
  Music,
  Play,
  Radio,
} from "lucide-react";
import type {
  AnalyticsDatePreset,
  ZedbuteArtistAnalyticsPayload,
  ZedbuteReleaseAnalyticsPayload,
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

export function ArtistAnalyticsSection({
  externalReleaseId,
}: {
  externalReleaseId?: string | null;
}) {
  const defaults = useMemo(() => getDefaultCustomDates(), []);

  const [activeTab, setActiveTab] = useState<"overview" | "release">("overview");
  const [preset, setPreset] = useState<AnalyticsDatePreset>("30d");
  const [customFrom, setCustomFrom] = useState(defaults.from);
  const [customTo, setCustomTo] = useState(defaults.to);
  const [appliedCustom, setAppliedCustom] = useState<{ fromDate: string; toDate: string }>({
    fromDate: defaults.from,
    toDate: defaults.to,
  });
  const [dateError, setDateError] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<ZedbuteArtistAnalyticsPayload | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [selectedReleaseId, setSelectedReleaseId] = useState<string>("");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [releaseData, setReleaseData] = useState<ZedbuteReleaseAnalyticsPayload | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const minAllowedDate = summaryData?.minAllowedDate || defaults.minAllowedDate;
  const maxAllowedDate = summaryData?.maxAllowedDate || defaults.maxAllowedDate;

  const currentQueryParams = useCallback(() => {
    if (preset === "custom") {
      return {
        range: "custom" as const,
        fromDate: appliedCustom.fromDate,
        toDate: appliedCustom.toDate,
      };
    }
    return { range: preset };
  }, [preset, appliedCustom]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await onceApi.getAnalyticsSummary(currentQueryParams());
      setSummaryData(data);
      if (!selectedReleaseId && data.availableReleases.length > 0) {
        setSelectedReleaseId(data.availableReleases[0].onceReleaseId);
      }
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : "Failed to load streaming analytics");
    } finally {
      setSummaryLoading(false);
    }
  }, [currentQueryParams, selectedReleaseId]);

  const loadReleaseAnalytics = useCallback(
    async (relId: string, storeId: string) => {
      if (!relId) return;
      setReleaseLoading(true);
      setReleaseError(null);
      try {
        const distId = storeId !== "all" ? Number(storeId) : null;
        const data = await onceApi.getReleaseAnalytics(relId, {
          ...currentQueryParams(),
          distributorId: distId,
        });
        setReleaseData(data);
      } catch (err: unknown) {
        setReleaseError(err instanceof Error ? err.message : "Failed to load release analytics");
      } finally {
        setReleaseLoading(false);
      }
    },
    [currentQueryParams]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (externalReleaseId) {
      setSelectedReleaseId(externalReleaseId);
      setDistributorFilter("all");
      setActiveTab("release");
    }
  }, [externalReleaseId]);

  useEffect(() => {
    if (activeTab === "release" && selectedReleaseId) {
      loadReleaseAnalytics(selectedReleaseId, distributorFilter);
    }
  }, [activeTab, selectedReleaseId, distributorFilter, loadReleaseAnalytics]);

  const handlePresetChange = (next: AnalyticsDatePreset) => {
    setDateError(null);
    setPreset(next);
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) {
      setDateError("Please select both a start date and an end date.");
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

  const handleRefresh = () => {
    loadSummary();
    if (activeTab === "release" && selectedReleaseId) {
      loadReleaseAnalytics(selectedReleaseId, distributorFilter);
    }
  };

  const inspectReleaseBreakdown = (onceReleaseId: string) => {
    setSelectedReleaseId(onceReleaseId);
    setDistributorFilter("all");
    setActiveTab("release");
  };

  const availableReleases = summaryData?.availableReleases || [];

  return (
    <Card className="bg-card border border-border rounded-lg">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Streaming Performance Analytics
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Verified store streams and YouTube Music views from ONCE across your own releases
            </CardDescription>
          </div>
          {summaryData && (
            <Badge variant="outline" className="text-[11px] font-mono">
              {summaryData.distributedReleasesCount} ONCE {summaryData.distributedReleasesCount === 1 ? "release" : "releases"}
            </Badge>
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
          loading={summaryLoading || releaseLoading}
          dateError={dateError}
          onPresetChange={handlePresetChange}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onApplyCustom={handleApplyCustom}
          onRefresh={handleRefresh}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "release")}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="overview" className="text-xs">
              Catalogue Overview
            </TabsTrigger>
            <TabsTrigger value="release" className="text-xs">
              Release &amp; Track Breakdown
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ARTIST CATALOGUE OVERVIEW */}
          <TabsContent value="overview" className="space-y-5 pt-3">
            {summaryLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Loading catalogue streaming analytics from ONCE...
              </div>
            ) : summaryError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">Unable to load streaming analytics</p>
                  <p className="text-muted-foreground">{summaryError}</p>
                </div>
              </div>
            ) : summaryData ? (
              <>
                {summaryData.notice && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-xs text-foreground flex items-start gap-2">
                    <Radio className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{summaryData.notice}</p>
                  </div>
                )}

                <AnalyticsKpiCards
                  kpis={summaryData.kpis}
                  fromDate={summaryData.fromDate}
                  toDate={summaryData.toDate}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <DailyStreamsChartCard
                      title="Daily Streaming History"
                      subtitle="Combined store streams and YouTube Music views per reported day"
                      metrics={summaryData.metrics}
                    />
                  </div>
                  <StoreBreakdownCard
                    stores={summaryData.topStores}
                    totalStreams={summaryData.kpis.totalStreams}
                  />
                </div>

                {/* Top Performing Releases */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Disc className="h-4 w-4 text-primary" />
                      Top-Performing Releases
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Select a release to view platform-by-platform totals and per-track streaming breakdown
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {summaryData.topReleases.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Release</TableHead>
                              <TableHead className="text-right">Store Streams</TableHead>
                              <TableHead className="text-right">YouTube Views</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summaryData.topReleases.map((rel) => (
                              <TableRow key={rel.releaseId}>
                                <TableCell>
                                  <div className="flex items-center gap-2.5">
                                    {rel.coverArtFileUrl ? (
                                      <img
                                        src={rel.coverArtFileUrl}
                                        alt={rel.title}
                                        className="w-9 h-9 rounded object-cover shrink-0"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                                        <Music className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{rel.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {rel.primaryArtistName}
                                      </p>
                                    </div>
                                  </div>
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
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => inspectReleaseBreakdown(rel.releaseId)}
                                  >
                                    Inspect
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                        No release streaming totals reported for this window yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <AnalyticsFreshnessNotice freshness={summaryData.freshness} />
              </>
            ) : null}
          </TabsContent>

          {/* TAB 2: INDIVIDUAL RELEASE & TRACK BREAKDOWN */}
          <TabsContent value="release" className="space-y-5 pt-3">
            {availableReleases.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg space-y-2">
                <Disc className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p>No ONCE-distributed releases found on your account yet.</p>
                <p>Once you submit and distribute a release through ONCE, you can inspect per-platform and per-track analytics here.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Select Your Release
                    </label>
                    <Select
                      value={selectedReleaseId}
                      onValueChange={(val) => {
                        setSelectedReleaseId(val);
                        setDistributorFilter("all");
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Choose a release" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReleases.map((r) => (
                          <SelectItem key={r.onceReleaseId} value={r.onceReleaseId} className="text-xs">
                            {r.title} — {r.primaryArtist} ({r.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Filter Store (Optional)
                    </label>
                    <Select
                      value={distributorFilter}
                      onValueChange={setDistributorFilter}
                      disabled={!releaseData || releaseData.distributors.length === 0}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="All Stores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">
                          All Stores Combined
                        </SelectItem>
                        {(releaseData?.distributors || []).map((d) => (
                          <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                            {d.name} ({formatNumber(d.total)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {releaseLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    Fetching release and track performance from ONCE...
                  </div>
                ) : releaseError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">Unable to load release analytics</p>
                      <p className="text-muted-foreground mt-0.5">{releaseError}</p>
                    </div>
                  </div>
                ) : releaseData ? (
                  <>
                    {releaseData.notice && (
                      <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-xs text-foreground flex items-start gap-2">
                        <Radio className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>{releaseData.notice}</p>
                      </div>
                    )}

                    <AnalyticsKpiCards
                      kpis={releaseData.kpis}
                      fromDate={releaseData.fromDate}
                      toDate={releaseData.toDate}
                    />

                    {/* Dedicated Platform Highlights */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <Card className="bg-card border-border">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Spotify Streams</p>
                          <p className="text-xl font-bold mt-1 tabular-nums">
                            {formatNumber(releaseData.platformHighlights.spotifyStreams)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Apple Music Streams</p>
                          <p className="text-xl font-bold mt-1 tabular-nums">
                            {formatNumber(releaseData.platformHighlights.appleMusicStreams)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">YouTube Music Views</p>
                          <p className="text-xl font-bold mt-1 tabular-nums">
                            {formatNumber(releaseData.platformHighlights.youtubeMusicViews)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border">
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Other Stores</p>
                          <p className="text-xl font-bold mt-1 tabular-nums">
                            {formatNumber(releaseData.platformHighlights.otherStoresStreams)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <DailyStreamsChartCard
                          title={`Daily Streams — ${releaseData.release.title}`}
                          subtitle="Daily reported store streams and YouTube Music views"
                          metrics={releaseData.metrics}
                        />
                      </div>
                      <StoreBreakdownCard
                        title="Release Store Breakdown"
                        stores={releaseData.distributors}
                        totalStreams={releaseData.kpis.totalStreams}
                      />
                    </div>

                    {/* Individual Track Performance */}
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <Play className="h-4 w-4 text-primary" />
                              Individual Track Performance
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Track-level store streams and YouTube Music views
                            </CardDescription>
                          </div>
                          {releaseData.storeScope === "all" && (
                            <Badge variant="secondary" className="text-[11px]">
                              Track breakdown shows all stores combined
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {releaseData.tracks.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Track</TableHead>
                                  <TableHead>Artist</TableHead>
                                  <TableHead className="text-right">Store Streams</TableHead>
                                  <TableHead className="text-right">YouTube Views</TableHead>
                                  <TableHead className="text-right">Total Streams</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {releaseData.tracks.map((track) => (
                                  <TableRow key={track.onceTrackId}>
                                    <TableCell className="font-medium">{track.trackName}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                      {track.artistName}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {formatNumber(track.storeStreams)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {formatNumber(track.youtubeViews)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                      {formatNumber(track.streamsCount)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                            No track-level streaming metrics reported for this release in the selected period.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <AnalyticsFreshnessNotice freshness={releaseData.freshness} />
                  </>
                ) : null}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
