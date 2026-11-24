import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Disc,
  Eye,
  ExternalLink,
  PencilLine,
  Radio,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import type { OnceDistributionReleaseRecord, StoreStatus } from "../../../server/once/types";

export interface DashboardMusicRelease {
  id: string;
  title: string;
  artist_name: string;
  release_type: string | null;
  release_date: string | null;
  cover_art_url: string | null;
  status: string | null;
  genre: string | null;
  updated_at: string | null;
}

export type CanonicalSubmissionStage = "pending" | "in_review" | "delivered" | "rejected";

interface UnifiedSubmissionItem {
  id: string;
  musicReleaseId?: string;
  onceRecord?: OnceDistributionReleaseRecord;
  title: string;
  artistName: string;
  releaseType: string;
  coverArtUrl?: string | null;
  rawStatus: string;
  stage: CanonicalSubmissionStage;
  statusLabel: string;
  statusDetail: string;
  updatedAt?: string | null;
  onceReleaseId?: string;
  storeStatuses: StoreStatus[];
  errorMessage?: string;
  reviewNotes?: string;
  isManualUnpaid: boolean;
  isEditable: boolean;
}

interface ReleaseSubmissionTrackerProps {
  musicReleases: DashboardMusicRelease[];
  onceReleases: OnceDistributionReleaseRecord[];
  syncing: boolean;
  lastSyncedAt: string | null;
  onRefreshAll: () => Promise<void> | void;
  onSyncSingle: (onceReleaseId: string) => Promise<void>;
  onOpenDetails: (release: OnceDistributionReleaseRecord) => void;
  onPayNow: (musicReleaseId: string) => void;
  onResumeDraft: (draftId: string) => void;
}

function classifyStatus(raw: string | null | undefined): {
  stage: CanonicalSubmissionStage;
  label: string;
  detail: string;
  stepIndex: number; // 0 = Pending, 1 = In Review, 2 = Delivered, -1 = Rejected
} {
  const s = (raw || "pending").toLowerCase().trim();
  switch (s) {
    case "unpaid":
      return {
        stage: "pending",
        label: "Awaiting Payment",
        detail: "Complete Mobile Money payment to queue for review",
        stepIndex: 0,
      };
    case "pending":
    case "pending_submission":
      return {
        stage: "pending",
        label: "Pending",
        detail: "Submission received and queued for review",
        stepIndex: 0,
      };
    case "queued":
    case "processing":
      return {
        stage: "pending",
        label: "Processing",
        detail: "Packaging audio, artwork, and metadata for review",
        stepIndex: 0,
      };
    case "under_review":
    case "in_review":
      return {
        stage: "in_review",
        label: "In Review",
        detail: "Metadata, audio, and rights check in progress",
        stepIndex: 1,
      };
    case "approved":
      return {
        stage: "in_review",
        label: "Approved",
        detail: "Approved — dispatching to selected streaming platforms",
        stepIndex: 1,
      };
    case "delivered":
      return {
        stage: "delivered",
        label: "Delivered",
        detail: "Delivered to streaming stores; store links appearing soon",
        stepIndex: 2,
      };
    case "distributed":
    case "live":
      return {
        stage: "delivered",
        label: "Live in Stores",
        detail: "Available on streaming platforms",
        stepIndex: 2,
      };
    case "rejected":
      return {
        stage: "rejected",
        label: "Rejected",
        detail: "Action needed — review feedback and resubmit",
        stepIndex: -1,
      };
    case "failed":
      return {
        stage: "rejected",
        label: "Failed",
        detail: "Distribution submission failed — update and retry",
        stepIndex: -1,
      };
    case "taken_down":
      return {
        stage: "rejected",
        label: "Taken Down",
        detail: "Removed from stores",
        stepIndex: -1,
      };
    default:
      return {
        stage: "pending",
        label: s ? s.replace(/_/g, " ") : "Pending",
        detail: "Tracking submission status",
        stepIndex: 0,
      };
  }
}

function getStageBadgeClass(stage: CanonicalSubmissionStage, rawStatus: string): string {
  const normalized = rawStatus.toLowerCase();
  if (normalized === "unpaid") {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  }
  switch (stage) {
    case "pending":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "in_review":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "delivered":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "rejected":
      return "bg-destructive/15 text-destructive border-destructive/30";
  }
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Just now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Just now";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatRelativeDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const PIPELINE_STEPS = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "in_review", label: "In Review", icon: Eye },
  { key: "delivered", label: "Delivered", icon: Send },
] as const;

export function ReleaseSubmissionTracker({
  musicReleases,
  onceReleases,
  syncing,
  lastSyncedAt,
  onRefreshAll,
  onSyncSingle,
  onOpenDetails,
  onPayNow,
  onResumeDraft,
}: ReleaseSubmissionTrackerProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | CanonicalSubmissionStage>("all");
  const [showAll, setShowAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const submissions = useMemo<UnifiedSubmissionItem[]>(() => {
    const byMusicId = new Map<string, OnceDistributionReleaseRecord>();
    const standaloneOnce: OnceDistributionReleaseRecord[] = [];

    for (const r of onceReleases) {
      if (r.release_id) {
        byMusicId.set(r.release_id, r);
      } else if (r.status !== "draft") {
        standaloneOnce.push(r);
      }
    }

    const items: UnifiedSubmissionItem[] = [];
    const seenIds = new Set<string>();

    for (const mr of musicReleases) {
      const matchedOnce = byMusicId.get(mr.id);
      // Pick whichever status is fresher or more specific
      let effectiveStatus = mr.status || matchedOnce?.status || "pending";
      if (matchedOnce) {
        const mrUpdated = mr.updated_at ? new Date(mr.updated_at).getTime() : 0;
        const onceUpdated = matchedOnce.updated_at ? new Date(matchedOnce.updated_at).getTime() : 0;
        if (onceUpdated >= mrUpdated && matchedOnce.status && matchedOnce.status !== "draft") {
          effectiveStatus = matchedOnce.status;
        }
      }

      const info = classifyStatus(effectiveStatus);
      const isEditable = ["draft", "pending_submission", "failed", "rejected"].includes(
        effectiveStatus.toLowerCase()
      );

      seenIds.add(mr.id);
      if (matchedOnce) seenIds.add(matchedOnce.id);

      items.push({
        id: mr.id,
        musicReleaseId: mr.id,
        onceRecord: matchedOnce,
        title: mr.title || matchedOnce?.title || "Untitled Release",
        artistName: mr.artist_name || matchedOnce?.primary_artist || "Artist",
        releaseType: mr.release_type || matchedOnce?.release_type || "single",
        coverArtUrl: mr.cover_art_url || matchedOnce?.cover_art_url,
        rawStatus: effectiveStatus,
        stage: info.stage,
        statusLabel: info.label,
        statusDetail: info.detail,
        updatedAt: matchedOnce?.updated_at || mr.updated_at,
        onceReleaseId: matchedOnce?.once_release_id,
        storeStatuses: matchedOnce?.store_statuses || [],
        errorMessage:
          matchedOnce?.submission_error ||
          matchedOnce?.validation_errors?.[0]?.message,
        reviewNotes: matchedOnce?.review_notes,
        isManualUnpaid: effectiveStatus.toLowerCase() === "unpaid",
        isEditable,
      });
    }

    for (const onceRec of standaloneOnce) {
      if (seenIds.has(onceRec.id)) continue;
      const info = classifyStatus(onceRec.status);
      const isEditable = ["draft", "pending_submission", "failed", "rejected"].includes(
        (onceRec.status || "").toLowerCase()
      );

      items.push({
        id: onceRec.id,
        onceRecord: onceRec,
        title: onceRec.title || "Untitled Release",
        artistName: onceRec.primary_artist || "Artist",
        releaseType: onceRec.release_type || "single",
        coverArtUrl: onceRec.cover_art_url,
        rawStatus: onceRec.status,
        stage: info.stage,
        statusLabel: info.label,
        statusDetail: info.detail,
        updatedAt: onceRec.updated_at || onceRec.submitted_at || onceRec.created_at,
        onceReleaseId: onceRec.once_release_id,
        storeStatuses: onceRec.store_statuses || [],
        errorMessage:
          onceRec.submission_error ||
          onceRec.validation_errors?.[0]?.message,
        reviewNotes: onceRec.review_notes,
        isManualUnpaid: false,
        isEditable,
      });
    }

    // Sort newest updated first, prioritizing active submissions
    return items.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [musicReleases, onceReleases]);

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      pending: submissions.filter((s) => s.stage === "pending").length,
      in_review: submissions.filter((s) => s.stage === "in_review").length,
      delivered: submissions.filter((s) => s.stage === "delivered").length,
      rejected: submissions.filter((s) => s.stage === "rejected").length,
    };
  }, [submissions]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return submissions;
    return submissions.filter((s) => s.stage === activeFilter);
  }, [submissions, activeFilter]);

  const visibleItems = showAll ? filtered : filtered.slice(0, 4);
  const hasActiveProgress = counts.pending > 0 || counts.in_review > 0;

  const handleSyncSingle = async (onceReleaseId: string) => {
    setSyncingId(onceReleaseId);
    try {
      await onSyncSingle(onceReleaseId);
    } finally {
      setSyncingId(null);
    }
  };

  const buildFallbackEngineRecord = (item: UnifiedSubmissionItem): OnceDistributionReleaseRecord => {
    if (item.onceRecord) return item.onceRecord;
    return {
      id: item.id,
      release_id: item.musicReleaseId,
      user_id: "",
      title: item.title,
      primary_artist: item.artistName,
      release_type: item.releaseType,
      cover_art_url: item.coverArtUrl || undefined,
      metadata: {},
      distribution_store_ids: [1, 9, 13, 319, 17, 14, 309],
      store_statuses: item.storeStatuses,
      artist_profiles: [],
      status: item.rawStatus,
      is_ai_detected: false,
      acr_matched: false,
      credit_cost: 1,
      credits_debited: 0,
      created_at: item.updatedAt || new Date().toISOString(),
      updated_at: item.updatedAt || new Date().toISOString(),
    };
  };

  return (
    <Card className="mb-4 bg-card border border-border rounded-lg" data-testid="release-submission-tracker">
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Release Submission Progress</h2>
              {hasActiveProgress && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                  title="Automatically updates when release statuses change"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time status tracking from submission through review to store delivery
              {lastSyncedAt ? ` · Synced ${formatSyncTime(lastSyncedAt)}` : ""}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={() => void onRefreshAll()}
            className="h-8 text-xs gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Refresh Status"}
          </Button>
        </div>

        {/* Filter Chips */}
        {submissions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {(
              [
                { key: "all", label: "All", count: counts.all },
                { key: "pending", label: "Pending", count: counts.pending },
                { key: "in_review", label: "In Review", count: counts.in_review },
                { key: "delivered", label: "Delivered", count: counts.delivered },
                { key: "rejected", label: "Rejected", count: counts.rejected },
              ] as const
            ).map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveFilter(tab.key);
                    setShowAll(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded px-1 py-0 text-[10px] ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {submissions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center space-y-2">
            <Radio className="h-8 w-8 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium">No active release submissions yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Once you submit a single, EP, or album, you can track its real-time progress across Pending, In Review, and Delivered stages right here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-6 text-center">
            <p className="text-xs text-muted-foreground">No submissions currently in this stage.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const info = classifyStatus(item.rawStatus);
              const liveStoresCount = item.storeStatuses.filter((s) =>
                /live|delivered|distributed/i.test(s.statusText || "")
              ).length;
              const isSyncingThis = Boolean(item.onceReleaseId && syncingId === item.onceReleaseId);

              return (
                <div
                  key={item.id}
                  data-testid={`submission-progress-${item.id}`}
                  className={`rounded-lg border p-3.5 bg-background transition-colors ${
                    item.stage === "rejected"
                      ? "border-destructive/40"
                      : item.isManualUnpaid
                        ? "border-amber-500/40"
                        : "border-border"
                  }`}
                >
                  {/* Top Row: Artwork + Title + Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.coverArtUrl ? (
                        <img
                          src={item.coverArtUrl}
                          alt={item.title}
                          className="w-11 h-11 rounded object-cover shrink-0 border border-border/50"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded bg-muted flex items-center justify-center shrink-0">
                          <Disc className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{item.title}</p>
                          <Badge variant="outline" className="text-[10px] capitalize h-5 px-1.5">
                            {item.releaseType}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.artistName}
                          {item.updatedAt ? ` · Updated ${formatRelativeDate(item.updatedAt)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Badge className={`${getStageBadgeClass(item.stage, item.rawStatus)} border`}>
                        {item.stage === "delivered" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {item.stage === "in_review" && <Eye className="h-3 w-3 mr-1" />}
                        {item.stage === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {item.stage === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                        {item.statusLabel}
                      </Badge>
                    </div>
                  </div>

                  {/* 3-Step Visual Progress Stepper */}
                  <div className="mt-3.5 pt-3 border-t border-border/60">
                    {item.stage === "rejected" ? (
                      <div className="flex items-start gap-2.5 rounded-md bg-destructive/10 border border-destructive/25 p-2.5 text-xs">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-semibold text-destructive">{item.statusLabel}</p>
                          <p className="text-muted-foreground">
                            {item.reviewNotes || item.errorMessage || item.statusDetail}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          {PIPELINE_STEPS.map((step, idx) => {
                            const StepIcon = step.icon;
                            const isCompleted = info.stepIndex > idx || (idx === 2 && info.stepIndex === 2);
                            const isCurrent = info.stepIndex === idx && !(idx === 2 && info.stepIndex === 2);
                            return (
                              <div key={step.key} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    isCompleted
                                      ? "bg-emerald-500"
                                      : isCurrent
                                        ? "bg-primary animate-pulse"
                                        : "bg-muted"
                                  }`}
                                />
                                <div className="flex items-center gap-1 text-[11px]">
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <StepIcon
                                      className={`h-3.5 w-3.5 shrink-0 ${
                                        isCurrent ? "text-primary" : "text-muted-foreground/60"
                                      }`}
                                    />
                                  )}
                                  <span
                                    className={`truncate font-medium ${
                                      isCompleted
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : isCurrent
                                          ? "text-foreground"
                                          : "text-muted-foreground/70"
                                    }`}
                                  >
                                    {step.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{item.statusDetail}</p>
                      </div>
                    )}
                  </div>

                  {/* Store Delivery Breakdown & Quick Actions */}
                  {(item.storeStatuses.length > 0 || item.isManualUnpaid || item.onceReleaseId || (item.isEditable && item.onceRecord)) && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Store delivery pills */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        {item.storeStatuses.length > 0 ? (
                          <>
                            <span className="text-muted-foreground font-medium mr-0.5">
                              Stores ({liveStoresCount}/{item.storeStatuses.length} live):
                            </span>
                            {item.storeStatuses.slice(0, 3).map((st) => (
                              <span
                                key={st.storeId}
                                className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px]"
                              >
                                <span className="font-medium">{st.storeName}</span>
                                <span className="text-muted-foreground">· {st.statusText || "Pending"}</span>
                                {st.urlInStore && (
                                  <a
                                    href={st.urlInStore}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                    title={`Open on ${st.storeName}`}
                                  >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </span>
                            ))}
                            {item.storeStatuses.length > 3 && (
                              <span className="text-muted-foreground">
                                +{item.storeStatuses.length - 3} more
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {item.onceReleaseId
                              ? `ONCE ID: ${item.onceReleaseId}`
                              : item.isManualUnpaid
                                ? "Mobile Money payment pending"
                                : "Standard Zedbute distribution queue"}
                          </span>
                        )}
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {item.isManualUnpaid && item.musicReleaseId && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2.5 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => onPayNow(item.musicReleaseId!)}
                          >
                            <Smartphone className="h-3 w-3 mr-1" />
                            Pay Now
                          </Button>
                        )}
                        {item.isEditable && item.onceRecord && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => onResumeDraft(item.onceRecord!.id)}
                          >
                            <PencilLine className="h-3 w-3" />
                            Fix & Resubmit
                          </Button>
                        )}
                        {item.onceReleaseId && item.stage !== "delivered" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isSyncingThis}
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => void handleSyncSingle(item.onceReleaseId!)}
                          >
                            <RefreshCw className={`h-3 w-3 ${isSyncingThis ? "animate-spin" : ""}`} />
                            Sync Live
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => onOpenDetails(buildFallbackEngineRecord(item))}
                        >
                          <Radio className="h-3 w-3 text-primary" />
                          Details
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length > 4 && (
              <div className="pt-1 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowAll((prev) => !prev)}
                >
                  {showAll
                    ? "Show fewer submissions"
                    : `Show all ${filtered.length} submissions`}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
