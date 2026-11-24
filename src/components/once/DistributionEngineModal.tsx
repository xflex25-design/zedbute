import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { onceApi } from "@/services/onceApi";
import type { OnceDistributionReleaseRecord } from "../../../server/once/types";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Music2,
  Cpu,
  Radio,
  FileWarning,
  PencilLine,
  MessageSquare,
} from "lucide-react";

interface DistributionEngineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: OnceDistributionReleaseRecord | null;
  onUpdate?: () => void;
}

export function DistributionEngineModal({
  open,
  onOpenChange,
  release,
  onUpdate,
}: DistributionEngineModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentRelease, setCurrentRelease] = useState<OnceDistributionReleaseRecord | null>(release);

  useEffect(() => {
    setCurrentRelease(release);
  }, [release]);

  if (!currentRelease) return null;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "live":
      case "distributed":
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Live in Stores</Badge>;
      case "approved":
        return <Badge className="bg-green-600 text-white hover:bg-green-700">Approved</Badge>;
      case "delivered":
        return <Badge className="bg-teal-600 text-white hover:bg-teal-700">Delivered to DSPs</Badge>;
      case "processing":
      case "queued":
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Processing</Badge>;
      case "under_review":
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Under Review</Badge>;
      case "pending_submission":
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Pending Submission</Badge>;
      case "failed":
        return <Badge variant="destructive">Submission Failed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const zedbuteFeeZmw =
    currentRelease.release_type === "album"
      ? 500
      : currentRelease.release_type === "ep"
      ? 200
      : 70;

  const isEditableDraft = ["draft", "pending_submission", "failed", "rejected"].includes(
    (currentRelease.status || "").toLowerCase()
  );

  const handleSyncStatus = async () => {
    setLoading(true);
    try {
      const liveStatus = await onceApi.getReleaseStatus(
        currentRelease.once_release_id || currentRelease.id
      );
      toast.success(`Status updated: ${liveStatus.aggregateStatus}`);
      const refreshed = await onceApi.getRelease(currentRelease.id);
      setCurrentRelease(refreshed);
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync status");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiDetection = async () => {
    if (!currentRelease.audio_url) {
      toast.error("No audio file URL recorded for this release");
      return;
    }
    setLoading(true);
    try {
      const res = await onceApi.runAIDetection({
        file_url: currentRelease.audio_url,
        file_name: `${currentRelease.title}.wav`,
        release_id: currentRelease.once_release_id,
      });

      toast.success(
        res.containsAi
          ? `AI-detected song (${res.aiScore}% score, ${res.predictedModel || "AI model"}) - 2 ONCE credits`
          : `Human-made song verified (${100 - res.aiScore}% confidence) - 1 ONCE credit`
      );

      const refreshed = await onceApi.getRelease(currentRelease.id);
      setCurrentRelease(refreshed);
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "AI detection check failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAcrCheck = async () => {
    if (!currentRelease.audio_url) {
      toast.error("No audio file URL recorded for this release");
      return;
    }
    setLoading(true);
    try {
      const res = await onceApi.runACRCheck({
        file_url: currentRelease.audio_url,
        file_name: `${currentRelease.title}.wav`,
      });

      if (res.matched && res.bestMatch) {
        toast.warning(
          `Registry match found: "${res.bestMatch.title}" by ${res.bestMatch.artist} (${res.bestMatch.queryMatchPercentage}% match)`
        );
      } else {
        toast.success("No copyright matches found in registry. Clean recording!");
      }

      const refreshed = await onceApi.getRelease(currentRelease.id);
      setCurrentRelease(refreshed);
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "ACR check failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    try {
      const res = await onceApi.retryRelease(currentRelease.id);
      toast.success(res.message);
      setCurrentRelease(res.release);
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to retry submission");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                Zedbute Distribution Engine
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                ONCE REST API Direct Pipeline & Store Delivery Monitor
              </DialogDescription>
            </div>
            {getStatusBadge(currentRelease.status)}
          </div>
        </DialogHeader>

        {/* Release Overview Banner */}
        <div className="p-3.5 rounded-lg border border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-sm">
          <div className="space-y-1">
            <h4 className="font-semibold text-base leading-tight">{currentRelease.title}</h4>
            <p className="text-xs text-muted-foreground">
              Primary Artist: <strong className="text-foreground">{currentRelease.primary_artist}</strong>{" "}
              <span className="capitalize">({currentRelease.release_type || "single"})</span>
            </p>
            {currentRelease.once_release_id && (
              <p className="text-xs text-muted-foreground font-mono">
                ONCE Release ID: <span className="text-primary">{currentRelease.once_release_id}</span>
              </p>
            )}
            {currentRelease.once_draft_id && !currentRelease.once_release_id && (
              <p className="text-xs text-muted-foreground font-mono">
                ONCE Draft ID: <span className="text-primary">{currentRelease.once_draft_id}</span>
              </p>
            )}
            {currentRelease.upc && (
              <p className="text-xs text-muted-foreground">
                UPC: <span className="font-mono">{currentRelease.upc}</span>
              </p>
            )}
            {typeof currentRelease.current_step === "number" && isEditableDraft && (
              <p className="text-xs text-muted-foreground">
                Saved at Wizard Step {currentRelease.current_step} of 5
              </p>
            )}
          </div>
          <div className="sm:text-right space-y-1.5 shrink-0">
            <div className="text-xs text-muted-foreground">
              Zedbute Service Fee: <span className="font-semibold text-foreground">K{zedbuteFeeZmw}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              ONCE API Cost:{" "}
              <span className="font-semibold text-primary">
                {currentRelease.credit_cost || 1} Credit (${currentRelease.credit_cost || 1})
              </span>
            </div>
            <div className="flex sm:justify-end gap-2 pt-1">
              {currentRelease.once_release_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={loading}
                  onClick={handleSyncStatus}
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  Sync Status
                </Button>
              )}
              {isEditableDraft && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/upload-release?draftId=${encodeURIComponent(currentRelease.id)}`);
                  }}
                >
                  <PencilLine className="h-3 w-3" />
                  Resume in Wizard
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Review Notes */}
        {currentRelease.review_notes && (
          <div className="p-3 rounded-lg border border-border/80 bg-muted/30 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2 font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                Administrator Review Notes
              </span>
              {currentRelease.reviewed_at && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {new Date(currentRelease.reviewed_at).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{currentRelease.review_notes}</p>
          </div>
        )}

        {/* Validation Issues */}
        {Array.isArray(currentRelease.validation_errors) && currentRelease.validation_errors.length > 0 && (
          <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
              <FileWarning className="h-4 w-4" />
              Metadata Issues Requiring Attention ({currentRelease.validation_errors.length})
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              {currentRelease.validation_errors.slice(0, 6).map((issue, i) => (
                <li key={`${issue.code}-${i}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Failure message & retry button */}
        {currentRelease.submission_error && (
          <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              ONCE / Submission Issue Reported
            </div>
            <p className="text-foreground/90 whitespace-pre-wrap">{currentRelease.submission_error}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/upload-release?draftId=${encodeURIComponent(currentRelease.id)}`);
                }}
              >
                <PencilLine className="h-3 w-3" />
                Fix in Upload Wizard
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                disabled={loading}
                onClick={handleRetry}
              >
                Retry Submission
              </Button>
            </div>
          </div>
        )}

        {/* AI Detection & Audio Intelligence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              Audio Intelligence & AI Detection
            </h5>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 gap-1"
                disabled={loading || !currentRelease.audio_url}
                onClick={handleRunAiDetection}
              >
                <Sparkles className="h-3 w-3 text-amber-500" />
                AI Check
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 gap-1"
                disabled={loading || !currentRelease.audio_url}
                onClick={handleRunAcrCheck}
              >
                <ShieldAlert className="h-3 w-3 text-blue-500" />
                ACR Match
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-md border border-border/60 bg-muted/20 space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span>AI Song Detection:</span>
                {currentRelease.is_ai_detected ? (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-[11px]">
                    AI-Detected ({currentRelease.ai_score ?? 0}%)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-500 border-green-500/40 text-[11px]">
                    Human-Made Song
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {currentRelease.is_ai_detected
                  ? `Classified as AI (${currentRelease.predicted_ai_model || "AI Model"}). Billed at 2 ONCE credits.`
                  : "Verified human composition. Standard rate of 1 ONCE credit."}
              </p>
            </div>

            <div className="p-3 rounded-md border border-border/60 bg-muted/20 space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span>Registry ACR Check:</span>
                {currentRelease.acr_matched ? (
                  <Badge variant="outline" className="text-destructive border-destructive/40 text-[11px]">
                    Match Found ({currentRelease.acr_best_match?.queryMatchPercentage ?? 0}%)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[11px]">
                    Clear Registry
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {currentRelease.acr_matched && currentRelease.acr_best_match
                  ? `Matched: "${currentRelease.acr_best_match.title}" (${currentRelease.acr_best_match.artist || "Unknown"})`
                  : "No conflicting existing audio in Pex / Identify Music registry."}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Store Delivery Statuses Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Music2 className="h-3.5 w-3.5 text-primary" />
              DSP Store Delivery Statuses
            </h5>
            <span className="text-xs text-muted-foreground">
              {currentRelease.store_statuses?.length || 0} stores tracked
            </span>
          </div>

          {currentRelease.store_statuses && currentRelease.store_statuses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {currentRelease.store_statuses.map((store) => (
                <div
                  key={store.storeId}
                  className="p-2.5 rounded-md border border-border/60 bg-card/40 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate space-y-0.5">
                    <p className="font-semibold truncate">{store.storeName}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {store.statusText?.toLowerCase().includes("live") ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      <span>{store.statusText || "Pending delivery"}</span>
                    </p>
                  </div>
                  {store.urlInStore ? (
                    <a
                      href={store.urlInStore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : store.linkPending ? (
                    <span className="text-[10px] text-muted-foreground italic">Link pending</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-md border border-dashed border-border/80 text-center text-xs text-muted-foreground">
              No store delivery statuses reported yet. Statuses populate once distributor approves and dispatches release.
            </div>
          )}
        </div>

        {/* Artist Profiles linked */}
        {currentRelease.artist_profiles && currentRelease.artist_profiles.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verified DSP Artist Profiles
            </h5>
            <div className="space-y-1.5">
              {currentRelease.artist_profiles.map((profile, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded border border-border/50 bg-muted/20 flex items-center justify-between text-xs"
                >
                  <span className="font-medium">
                    {profile.name} {profile.isPrimary && "(Primary)"}
                  </span>
                  <div className="flex items-center gap-2">
                    {profile.spotifyArtistUrl && (
                      <a
                        href={profile.spotifyArtistUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Spotify <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {profile.appleMusicArtistUrl && (
                      <a
                        href={profile.appleMusicArtistUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Apple Music <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
