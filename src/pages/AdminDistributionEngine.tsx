import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { onceApi } from "@/services/onceApi";
import { DistributionEngineModal } from "@/components/once/DistributionEngineModal";
import { AdminAnalyticsSection } from "@/components/once/AdminAnalyticsSection";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type {
  OnceAuditLogRecord,
  OnceDistributionReleaseRecord,
  OnceEngineSettingsRecord,
} from "../../../server/once/types";
import {
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Settings,
  Activity,
  Coins,
  Send,
  ShieldAlert,
  Loader2,
  FileWarning,
  ClipboardList,
  Search,
  Check,
  XCircle,
  RotateCcw,
} from "lucide-react";

type StatusFilter = "all" | "needs_review" | "active" | "failed" | "draft";

export default function AdminDistributionEngine() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [onceCredits, setOnceCredits] = useState<any>(null);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [settings, setSettings] = useState<OnceEngineSettingsRecord | null>(null);
  const [releases, setReleases] = useState<OnceDistributionReleaseRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<OnceAuditLogRecord[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<OnceDistributionReleaseRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Release filtering & review dialog
  const [releaseSearch, setReleaseSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reviewTarget, setReviewTarget] = useState<OnceDistributionReleaseRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  // Audit log filters
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");

  // Form state for settings
  const [singlePrice, setSinglePrice] = useState("70");
  const [autoDistribute, setAutoDistribute] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  // Webhook register state
  const [webhookUrl, setWebhookUrl] = useState(`${window.location.origin}/api/webhooks/once`);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [webhookSecretConfigured, setWebhookSecretConfigured] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminMetrics, relsList, engineSettings, logs] = await Promise.all([
        onceApi.getAdminMetrics().catch(() => null),
        onceApi.getAdminReleases().catch(() => []),
        onceApi.getAdminSettings().catch(() => null),
        onceApi.getAdminAuditLogs({ limit: 200 }).catch(() => []),
      ]);

      if (adminMetrics) {
        setMetrics(adminMetrics.metrics);
        setOnceCredits(adminMetrics.onceCredits);
        setFinancialSummary(adminMetrics.financialSummary);
        setWebhooks(adminMetrics.recentWebhooks || []);
        setWebhookSecretConfigured(Boolean(adminMetrics.webhookSecretConfigured));
      }
      setReleases(relsList || []);
      setAuditLogs(logs || []);
      if (engineSettings) {
        setSettings(engineSettings);
        setSinglePrice(String(engineSettings.single_upload_price_zmw || 70));
        setAutoDistribute(Boolean(engineSettings.auto_distribute_default));
        setRequireApproval(Boolean(engineSettings.require_admin_approval));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load Distribution Engine data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = Boolean(roles?.some((r) => r.role === "admin"));
      setIsAdmin(admin);
      if (admin) {
        await loadData();
      } else {
        setLoading(false);
      }
    };
    void checkAdminAndLoad();
  }, [navigate]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await onceApi.updateAdminSettings({
        single_upload_price_zmw: Number(singlePrice) || 70,
        auto_distribute_default: autoDistribute,
        require_admin_approval: requireApproval,
      });
      setSettings(updated);
      toast.success("Distribution Engine settings updated successfully");
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRegisterWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Please enter a valid webhook URL");
      return;
    }
    setRegisteringWebhook(true);
    try {
      await onceApi.registerWebhook({
        url: webhookUrl,
        description: "Zedbute Production Webhook Endpoint",
      });
      toast.success("Webhook endpoint registered with ONCE successfully");
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Webhook registration failed");
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const handleReviewAction = async (
    releaseId: string,
    action: "approve_and_submit" | "approve_manual" | "reject" | "sync_status"
  ) => {
    setReviewBusy(true);
    try {
      const res = await onceApi.reviewAdminRelease(releaseId, {
        action,
        notes: reviewNotes.trim() || undefined,
      });
      toast.success(res.message);
      setReviewTarget(null);
      setReviewNotes("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Admin review action failed");
      await loadData();
    } finally {
      setReviewBusy(false);
    }
  };

  const handleRetryRelease = async (releaseId: string) => {
    setReviewBusy(true);
    try {
      const res = await onceApi.retryRelease(releaseId);
      toast.success(res.message);
      setReviewTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Retry submission failed");
      await loadData();
    } finally {
      setReviewBusy(false);
    }
  };

  const inspectRelease = (release: OnceDistributionReleaseRecord) => {
    setSelectedRelease(release);
    setModalOpen(true);
  };

  const openReviewModal = (release: OnceDistributionReleaseRecord) => {
    setReviewTarget(release);
    setReviewNotes(release.review_notes || "");
  };

  const filteredReleases = useMemo(() => {
    const q = releaseSearch.trim().toLowerCase();
    return releases.filter((rel) => {
      const st = (rel.status || "").toLowerCase();
      if (statusFilter === "needs_review" && !["pending_submission", "under_review"].includes(st)) {
        return false;
      }
      if (
        statusFilter === "active" &&
        !["processing", "queued", "approved", "delivered", "live", "distributed"].includes(st)
      ) {
        return false;
      }
      if (statusFilter === "failed" && !["failed", "rejected"].includes(st)) {
        return false;
      }
      if (statusFilter === "draft" && st !== "draft") {
        return false;
      }
      if (!q) return true;
      return (
        (rel.title || "").toLowerCase().includes(q) ||
        (rel.primary_artist || "").toLowerCase().includes(q) ||
        (rel.once_release_id || "").toLowerCase().includes(q) ||
        (rel.submission_error || "").toLowerCase().includes(q)
      );
    });
  }, [releases, releaseSearch, statusFilter]);

  const failedCount = useMemo(
    () => releases.filter((r) => ["failed", "rejected"].includes((r.status || "").toLowerCase())).length,
    [releases]
  );

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditActionFilter !== "all" && log.action !== auditActionFilter) return false;
      if (auditStatusFilter !== "all" && log.status !== auditStatusFilter) return false;
      if (!q) return true;
      return (
        (log.summary || "").toLowerCase().includes(q) ||
        (log.error_message || "").toLowerCase().includes(q) ||
        (log.actor_email || "").toLowerCase().includes(q) ||
        (log.once_release_id || "").toLowerCase().includes(q) ||
        (log.release_id || "").toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditActionFilter, auditStatusFilter, auditSearch]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 max-w-md">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">Admins only</h2>
              <p className="text-sm text-muted-foreground">
                Administrator privileges are required to access the Zedbute Distribution Engine console.
              </p>
              <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-16 max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Radio className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Zedbute Distribution Engine
              </h1>
              <Badge variant="outline" className="text-primary border-primary/40 font-mono text-xs">
                ONCE v1 API · Tag: ZEDBUTE
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Submission review, ONCE API delivery monitoring, error inspection, pricing controls, and audit log.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              Manual Releases
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/payouts")}>
              Payouts
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh Engine
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Card className="shadow-card">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Total Releases</CardDescription>
              <CardTitle className="text-2xl font-bold">{metrics?.totalReleases ?? releases.length}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              {metrics?.totalSubmitted ?? 0} submitted · {metrics?.drafts ?? 0} drafts
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Live in Stores</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-500">{metrics?.live ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              {metrics?.approved ?? 0} approved / delivered
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">API Credits Spent</CardDescription>
              <CardTitle className="text-2xl font-bold text-primary flex items-center gap-1">
                <Coins className="h-5 w-5" />
                {metrics?.totalCreditsSpent ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              {metrics?.humanSongs ?? 0} Human (1 credit) · {metrics?.aiSongs ?? 0} AI (2 credits)
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">ONCE Account Balance</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-500">
                {onceCredits?.credits !== undefined
                  ? `${onceCredits.credits} Credits`
                  : onceCredits?.error
                  ? "Check Token"
                  : "Available"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              {failedCount > 0 ? (
                <span className="text-destructive font-medium">{failedCount} failed / rejected items</span>
              ) : (
                "All systems operational"
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial & Currency Ledger (ZMW / USD) */}
        {financialSummary && (
          <Card className="shadow-card border-primary/20 bg-card mb-6">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    Financial & Currency Ledger (ZMW / USD)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Customer payments in Zambian Kwacha (ZMW) via Lenco, with automated USD conversion, actual ONCE distribution expenses ($1/$2), and net profit.
                  </CardDescription>
                </div>
                {financialSummary.lowCreditWarning && (
                  <Badge variant="destructive" className="gap-1 text-xs animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Low ONCE Credits ({financialSummary.remainingOnceCredits ?? 0} remaining)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border/70 bg-background space-y-1">
                  <p className="text-muted-foreground">Total Revenue</p>
                  <p className="text-base font-bold text-foreground">K{financialSummary.totalRevenueZmw?.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">ZMW customer payments</p>
                </div>
                <div className="p-3 rounded-lg border border-border/70 bg-background space-y-1">
                  <p className="text-muted-foreground">Estimated USD</p>
                  <p className="text-base font-bold text-foreground">${financialSummary.estimatedUsdEquivalent?.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">At 1 USD = K{financialSummary.exchangeRateUsed} ({financialSummary.exchangeRateDate})</p>
                </div>
                <div className="p-3 rounded-lg border border-border/70 bg-background space-y-1">
                  <p className="text-muted-foreground">ONCE Expenses</p>
                  <p className="text-base font-bold text-primary">${financialSummary.actualOnceExpensesUsd?.toLocaleString()} USD</p>
                  <p className="text-[10px] text-muted-foreground">$1 human / $2 AI song</p>
                </div>
                <div className="p-3 rounded-lg border border-border/70 bg-background space-y-1">
                  <p className="text-muted-foreground">Lenco Gateway Fees</p>
                  <p className="text-base font-bold text-amber-500">K{financialSummary.lencoFeesZmw?.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">~2.5% (${financialSummary.lencoFeesUsd} USD)</p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 space-y-1">
                  <p className="text-muted-foreground font-medium">Net Profit (ZMW)</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">K{financialSummary.netProfitZmw?.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-600/80">After ONCE & Lenco fees</p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 space-y-1">
                  <p className="text-muted-foreground font-medium">Net Profit (USD)</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">${financialSummary.netProfitUsd?.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-600/80">Converted equivalent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly ZMW Revenue & USD Converted Profit Visualization */}
        {financialSummary && Array.isArray(financialSummary.monthlyTrends) && financialSummary.monthlyTrends.length > 0 && (
          <Card className="shadow-card border-border bg-card mb-6">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Monthly ZMW Revenue & USD Converted Profit Trends
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monthly tracking of Zambian Kwacha (ZMW) distribution revenue alongside converted USD profit
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {financialSummary.monthlyTrends.length} {financialSummary.monthlyTrends.length === 1 ? "Month" : "Months"} Tracked
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financialSummary.monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorZmw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `K${v}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === "revenueZmw") return [`K${Number(value).toLocaleString()} ZMW`, "Monthly Revenue"];
                        if (name === "netProfitUsd") return [`$${Number(value).toLocaleString()} USD`, "Converted Net Profit"];
                        if (name === "estimatedUsd") return [`$${Number(value).toLocaleString()} USD`, "Estimated Revenue (USD)"];
                        if (name === "netProfitZmw") return [`K${Number(value).toLocaleString()} ZMW`, "Net Profit (ZMW)"];
                        return [value, name];
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenueZmw"
                      name="revenueZmw"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorZmw)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="netProfitUsd"
                      name="netProfitUsd"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorUsd)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engine Settings & Webhooks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Distribution Engine Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Configure pricing and automation policies. Zedbute's K70 single upload fee is kept separate from ONCE credits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Single-Song Upload Price (ZMW)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Zedbute distribution fee charged to artist (Standard: K70)
                  </p>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    value={singlePrice}
                    onChange={(e) => setSinglePrice(e.target.value)}
                    className="h-8 text-right font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Default Distribution Workflow</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enable automated ONCE API distribution pipeline as default option
                  </p>
                </div>
                <Switch checked={autoDistribute} onCheckedChange={setAutoDistribute} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Admin Verification Gate</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Require admin confirmation before dispatching API credits
                  </p>
                </div>
                <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
              </div>

              <Button
                type="button"
                className="w-full h-8 text-xs font-semibold"
                onClick={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? "Saving..." : "Save Engine Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Webhook Configuration Panel */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                ONCE Webhook Listener
              </CardTitle>
              <CardDescription className="text-xs">
                Receives <code className="text-primary">release.status_changed</code> &{" "}
                <code className="text-primary">release.approved</code> events with HMAC-SHA256 verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
                <span className="font-medium">Signing Secret (`ONCE_WEBHOOK_SECRET`)</span>
                <Badge variant={webhookSecretConfigured ? "outline" : "destructive"} className="text-[10px]">
                  {webhookSecretConfigured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">HTTPS Webhook Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-domain.com/api/webhooks/once"
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={handleRegisterWebhook}
                    disabled={registeringWebhook}
                  >
                    Register
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Recent Webhook Deliveries</span>
                  <span>{webhooks.length} events logged</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {webhooks.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded border border-border/50 bg-muted/20 flex items-center justify-between text-[11px]"
                    >
                      <div className="truncate space-y-0.5">
                        <span className="font-mono text-primary font-medium">{evt.eventType}</span>
                        <span className="text-muted-foreground ml-2">
                          ID: {evt.onceReleaseId || "N/A"}
                        </span>
                      </div>
                      <Badge variant={evt.processed ? "outline" : "destructive"} className="text-[10px] h-5">
                        {evt.processed ? "Verified" : "Rejected"}
                      </Badge>
                    </div>
                  ))}
                  {webhooks.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic text-center py-4">
                      No webhook deliveries received yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zedbute Admin Streaming Analytics Overview */}
        <AdminAnalyticsSection />

        {/* Releases Table + Review Controls */}
        <Card className="shadow-card">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Distribution Pipeline & Submission Review
                </CardTitle>
                <CardDescription className="text-xs">
                  Review artist submissions, inspect ONCE API validation or delivery errors, approve/dispatch, and sync store statuses.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredReleases.length} of {releases.length} Shown
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "needs_review", label: "Needs Review" },
                    { key: "active", label: "Processing / Live" },
                    { key: "failed", label: `Errors (${failedCount})` },
                    { key: "draft", label: "Drafts" },
                  ] as const
                ).map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    size="sm"
                    variant={statusFilter === tab.key ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  value={releaseSearch}
                  onChange={(e) => setReleaseSearch(e.target.value)}
                  placeholder="Search title, artist, ONCE ID, error..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReleases.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/70 text-muted-foreground text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Title & Artist</th>
                      <th className="py-2.5 px-3">ONCE ID / Step</th>
                      <th className="py-2.5 px-3">Status & Errors</th>
                      <th className="py-2.5 px-3">AI Detection</th>
                      <th className="py-2.5 px-3">Stores</th>
                      <th className="py-2.5 px-3">Cost</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredReleases.map((rel) => {
                      const hasError = Boolean(rel.submission_error) || (rel.validation_errors?.length || 0) > 0;
                      return (
                        <tr key={rel.id} className="hover:bg-muted/30 transition-colors align-top">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-foreground text-sm leading-tight">{rel.title || "Untitled"}</p>
                            <p className="text-muted-foreground text-xs">{rel.primary_artist || "Artist pending"}</p>
                            <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                              {rel.release_type || "single"}
                            </p>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-primary">
                            {rel.once_release_id
                              ? `${rel.once_release_id.substring(0, 10)}...`
                              : rel.once_draft_id
                              ? `Draft:${rel.once_draft_id.substring(0, 8)}`
                              : `Wizard Step ${rel.current_step || 1}/5`}
                          </td>
                          <td className="py-3 px-3 space-y-1 max-w-xs">
                            <Badge
                              variant={
                                ["live", "distributed", "approved"].includes(rel.status)
                                  ? "default"
                                  : ["failed", "rejected"].includes(rel.status)
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-[11px] capitalize"
                            >
                              {rel.status.replace(/_/g, " ")}
                            </Badge>
                            {rel.submission_error && (
                              <p className="text-[11px] text-destructive flex items-start gap-1 leading-snug">
                                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{rel.submission_error}</span>
                              </p>
                            )}
                            {!rel.submission_error && (rel.validation_errors?.length || 0) > 0 && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <FileWarning className="h-3 w-3 shrink-0" />
                                {rel.validation_errors!.length} validation issue(s)
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {rel.is_ai_detected ? (
                              <span className="text-amber-500 font-medium flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI ({rel.ai_score ?? 0}%)
                              </span>
                            ) : (
                              <span className="text-emerald-500 font-medium">Human</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {rel.store_statuses && rel.store_statuses.length > 0 ? (
                              <span className="text-foreground font-medium">
                                {rel.store_statuses.filter((s) => s.statusText?.toLowerCase().includes("live")).length} /{" "}
                                {rel.store_statuses.length} Live
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">
                                {rel.distribution_store_ids?.length || 0} selected
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium">
                            {rel.credit_cost || 1} Credit (${rel.credit_cost || 1})
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                type="button"
                                variant={hasError ? "destructive" : "default"}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openReviewModal(rel)}
                              >
                                Review
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => inspectRelease(rel)}
                              >
                                Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                <Radio className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p>No releases match the selected filter.</p>
                <p className="text-[11px]">
                  Drafts, submissions, and ONCE API errors will appear here for review.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribution Audit Log */}
        <Card className="shadow-card">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  ONCE Distribution Audit Log
                </CardTitle>
                <CardDescription className="text-xs">
                  Chronological record of draft saves, quotes, submissions, admin reviews, webhooks, and ONCE API errors.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {filteredAuditLogs.length} events
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search summary, actor, release ID, error..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filter action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="draft_saved">Draft Saved</SelectItem>
                  <SelectItem value="quote_generated">Quote Generated</SelectItem>
                  <SelectItem value="release_submitted">Release Submitted</SelectItem>
                  <SelectItem value="submission_failed">Submission Failed</SelectItem>
                  <SelectItem value="admin_approved_and_submitted">Admin Approved & Submitted</SelectItem>
                  <SelectItem value="admin_approved">Admin Approved</SelectItem>
                  <SelectItem value="admin_rejected">Admin Rejected</SelectItem>
                  <SelectItem value="admin_retried">Admin Retried</SelectItem>
                  <SelectItem value="status_synced">Status Synced</SelectItem>
                  <SelectItem value="webhook_processed">Webhook Processed</SelectItem>
                  <SelectItem value="webhook_rejected">Webhook Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditStatusFilter} onValueChange={setAuditStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filter outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAuditLogs.length > 0 ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg border-border/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/70 text-muted-foreground text-[11px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Outcome</th>
                      <th className="py-2 px-3">Actor</th>
                      <th className="py-2 px-3">Summary & Error Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 align-top">
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              log.status === "error"
                                ? "destructive"
                                : log.status === "success"
                                ? "default"
                                : "outline"
                            }
                            className="text-[10px] capitalize"
                          >
                            {log.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <div className="font-medium truncate max-w-[140px]">
                            {log.actor_email || log.actor_role}
                          </div>
                          <div className="text-muted-foreground capitalize">{log.actor_role}</div>
                        </td>
                        <td className="py-2.5 px-3 space-y-0.5 max-w-md">
                          <p className="text-foreground">{log.summary}</p>
                          {(log.once_release_id || log.release_id) && (
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {log.once_release_id ? `ONCE: ${log.once_release_id}` : `Ref: ${log.release_id}`}
                            </p>
                          )}
                          {log.error_message && (
                            <p className="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1 mt-1">
                              {log.error_message}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No audit log entries match your current filter.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Review & Error Resolution Dialog */}
        <Dialog open={Boolean(reviewTarget)} onOpenChange={(o) => !o && setReviewTarget(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            {reviewTarget && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Admin Submission Review
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {reviewTarget.title} by {reviewTarget.primary_artist} ({reviewTarget.release_type})
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-xs">
                  {reviewTarget.submission_error && (
                    <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 space-y-1">
                      <div className="font-semibold text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        ONCE API / Submission Error
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap">{reviewTarget.submission_error}</p>
                    </div>
                  )}

                  {Array.isArray(reviewTarget.validation_errors) && reviewTarget.validation_errors.length > 0 && (
                    <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-1">
                      <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <FileWarning className="h-4 w-4" />
                        Validation Issues ({reviewTarget.validation_errors.length})
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                        {reviewTarget.validation_errors.map((issue, idx) => (
                          <li key={`${issue.code}-${idx}`}>{issue.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/20">
                    <div>
                      <span className="text-muted-foreground">Current Status:</span>{" "}
                      <strong className="capitalize">{reviewTarget.status.replace(/_/g, " ")}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Selected Stores:</span>{" "}
                      <strong>{reviewTarget.distribution_store_ids?.length || 0}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ONCE Release ID:</span>{" "}
                      <span className="font-mono">{reviewTarget.once_release_id || "Not submitted"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reviewed By:</span>{" "}
                      <span>{reviewTarget.reviewed_by || "Unreviewed"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-review-notes" className="text-xs font-semibold">
                      Review Notes / Rejection Reason
                    </Label>
                    <Textarea
                      id="admin-review-notes"
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Optional note for the artist or internal audit trail..."
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {!reviewTarget.once_release_id && (
                      <Button
                        type="button"
                        disabled={reviewBusy}
                        onClick={() => handleReviewAction(reviewTarget.id, "approve_and_submit")}
                        className="gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Approve & Submit to ONCE
                      </Button>
                    )}

                    {reviewTarget.once_release_id && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={reviewBusy}
                        onClick={() => handleReviewAction(reviewTarget.id, "sync_status")}
                        className="gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Sync Live ONCE Status
                      </Button>
                    )}

                    {["failed", "rejected"].includes((reviewTarget.status || "").toLowerCase()) && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={reviewBusy}
                        onClick={() => handleRetryRelease(reviewTarget.id)}
                        className="gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry ONCE Submission
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      disabled={reviewBusy}
                      onClick={() => handleReviewAction(reviewTarget.id, "approve_manual")}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Approve Release
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={reviewBusy}
                      onClick={() => handleReviewAction(reviewTarget.id, "reject")}
                      className="gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject with Notes
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal for detailed inspection & store delivery tracking */}
        <DistributionEngineModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          release={selectedRelease}
          onUpdate={loadData}
        />
      </div>
    </div>
  );
}
