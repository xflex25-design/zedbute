import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BadgeCheck,
  Smartphone,
  Disc,
  Music,
  Plus,
  Upload,
  TrendingUp,
  Download,
  Filter,
  Wallet,
  Bell,
  Check,
  Radio,
  BarChart3,
  FileEdit,
  Trash2,
  Clock,
  CheckCircle,
  CloudUpload,
  LayoutDashboard,
  HelpCircle,
  LogOut,
  Search,
  Menu,
  X,
  AlertCircle,
} from "lucide-react";
import { DistributionEngineModal } from "@/components/once/DistributionEngineModal";
import { ArtistAnalyticsSection } from "@/components/once/ArtistAnalyticsSection";
import { ReleaseSubmissionTracker } from "@/components/once/ReleaseSubmissionTracker";
import { onceApi } from "@/services/onceApi";
import type { OnceDistributionReleaseRecord } from "../../../server/once/types";

type Release = {
  id: string;
  title: string;
  artist_name: string;
  release_type: string | null;
  release_date: string | null;
  cover_art_url: string | null;
  status: string | null;
  genre: string | null;
  updated_at: string | null;
};

const formatUpdated = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const statusVariant = (status: string | null) => {
  switch ((status || "").toLowerCase()) {
    case "live":
    case "distributed":
    case "delivered":
      return "bg-foreground text-background border-foreground font-bold";
    case "approved":
    case "under_review":
    case "in_review":
      return "bg-secondary text-foreground border-foreground/40 font-bold";
    case "processing":
    case "queued":
      return "bg-muted text-foreground border-border font-bold";
    case "unpaid":
    case "pending":
    case "pending_submission":
      return "bg-muted/70 text-foreground border-foreground/30 font-bold";
    case "rejected":
    case "failed":
      return "bg-destructive text-destructive-foreground border-destructive font-bold";
    default:
      return "bg-muted text-muted-foreground border-border font-bold";
  }
};

const statusLabel = (status: string | null) => {
  switch ((status || "").toLowerCase()) {
    case "live": return "Live";
    case "distributed": return "Distributed";
    case "delivered": return "Delivered";
    case "approved": return "Approved";
    case "under_review":
    case "in_review":
      return "In Review";
    case "processing": return "Processing";
    case "queued": return "Queued";
    case "unpaid": return "Unpaid";
    case "pending":
    case "pending_submission":
      return "Pending";
    case "rejected": return "Rejected";
    case "failed": return "Failed";
    default: return status ?? "Unknown";
  }
};

const verificationBadge = (status: string | null) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-foreground text-background border-foreground font-bold">Verified</Badge>;
    case "pending":
      return <Badge variant="secondary" className="border-border font-bold">Pending Review</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="font-bold">Rejected</Badge>;
    default:
      return <Badge variant="outline" className="font-bold">Not Applied</Badge>;
  }
};

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);
  const [promotingReleaseId, setPromotingReleaseId] = useState<string | null>(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoSocials, setPromoSocials] = useState("");
  const [promoAudience, setPromoAudience] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [submittingPromo, setSubmittingPromo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [engineModalOpen, setEngineModalOpen] = useState(false);
  const [activeEngineRelease, setActiveEngineRelease] = useState<OnceDistributionReleaseRecord | null>(null);
  const [onceReleasesMap, setOnceReleasesMap] = useState<Record<string, OnceDistributionReleaseRecord>>({});
  const [onceReleasesList, setOnceReleasesList] = useState<OnceDistributionReleaseRecord[]>([]);
  const [drafts, setDrafts] = useState<OnceDistributionReleaseRecord[]>([]);
  const [selectedAnalyticsReleaseId, setSelectedAnalyticsReleaseId] = useState<string | null>(null);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [lastStatusSyncAt, setLastStatusSyncAt] = useState<string | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread" | "releases" | "payments">("all");

  const [activeTab, setActiveTab] = useState<"dashboard" | "albums" | "drafts" | "pending" | "approved" | "uploaded" | "wallet" | "verification" | "notifications" | "help">("albums");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const unreadNotifCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const openReleaseAnalytics = (onceReleaseId: string) => {
    setSelectedAnalyticsReleaseId(onceReleaseId);
    const el = document.getElementById("artist-analytics");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openDistributionModal = (r: Release) => {
    const match = onceReleasesMap[r.id] || {
      id: r.id,
      release_id: r.id,
      user_id: user?.id || "",
      title: r.title,
      primary_artist: r.artist_name,
      release_type: r.release_type || "single",
      cover_art_url: r.cover_art_url || undefined,
      metadata: {},
      distribution_store_ids: [1, 9, 13, 319, 17, 14, 309],
      store_statuses: [],
      artist_profiles: [],
      status: r.status || "draft",
      is_ai_detected: false,
      acr_matched: false,
      credit_cost: 1,
      credits_debited: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActiveEngineRelease(match);
    setEngineModalOpen(true);
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const apiRes = await onceApi.listNotifications().catch(() => null);
      if (apiRes && Array.isArray(apiRes.notifications) && apiRes.notifications.length > 0) {
        setNotifications(apiRes.notifications);
        return;
      }
    } catch {
      // fallback to direct supabase
    }

    try {
      const { data: notifData } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notifData) {
        setNotifications(notifData);
      }
    } catch {
      // ignore
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await onceApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      toast({ title: "Marked as read" });
    } catch (err: any) {
      toast({ title: "Could not mark as read", description: err.message, variant: "destructive" });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await onceApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast({ title: "All cleared", description: "All notifications marked as read." });
    } catch (err: any) {
      toast({ title: "Could not mark all as read", description: err.message, variant: "destructive" });
    }
  };

  const fetchUserData = async (userId: string) => {
    const [{ data: profileData }, { data: verificationData }, { data: releasesData }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("artist_verifications")
          .select("status, artist_name")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("music_releases")
          .select("id, title, artist_name, release_type, release_date, cover_art_url, status, genre, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

    setProfile(profileData);
    setVerification(verificationData);
    setReleases(releasesData ?? []);

    await fetchNotifications(userId);

    try {
      const [list, draftList] = await Promise.all([
        onceApi.listReleases(userId).catch(() => [] as OnceDistributionReleaseRecord[]),
        onceApi.listDrafts().catch(() => [] as OnceDistributionReleaseRecord[]),
      ]);
      const map: Record<string, OnceDistributionReleaseRecord> = {};
      for (const r of list || []) {
        if (r.release_id) map[r.release_id] = r;
        map[r.id] = r;
      }
      setOnceReleasesList(list || []);
      setOnceReleasesMap(map);
      setDrafts(draftList || []);
      setLastStatusSyncAt(new Date().toISOString());
    } catch {
      // ignore
    }
  };

  const refreshSubmissionStatuses = async (syncLiveOnce = false) => {
    if (!user) return;
    setSyncingStatuses(true);
    try {
      if (syncLiveOnce) {
        const activeOnce = onceReleasesList.filter(
          (r) =>
            r.once_release_id &&
            ["pending", "queued", "processing", "under_review", "in_review", "approved"].includes(
              (r.status || "").toLowerCase()
            )
        );
        await Promise.all(
          activeOnce.slice(0, 6).map((r) =>
            onceApi.getReleaseStatus(r.once_release_id!).catch(() => null)
          )
        );
      }
      await fetchUserData(user.id);
    } finally {
      setSyncingStatuses(false);
    }
  };

  const syncSingleOnceRelease = async (onceReleaseId: string) => {
    if (!user) return;
    try {
      const live = await onceApi.getReleaseStatus(onceReleaseId);
      toast({
        title: "Status synced",
        description: `Current status: ${statusLabel(live.aggregateStatus)}`,
      });
      await fetchUserData(user.id);
    } catch (err: any) {
      toast({
        title: "Sync unavailable",
        description: err?.message || "Could not reach ONCE status API right now.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDraft = async (draftId: string, title: string) => {
    try {
      await onceApi.deleteDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast({ title: "Draft removed", description: `"${title}" draft was deleted.` });
    } catch (err: any) {
      toast({ title: "Could not delete draft", description: err.message, variant: "destructive" });
    }
  };

  const fetchPromotions = async (userId: string) => {
    setLoadingPromotions(true);
    const { data: promosData } = await supabase
      .from("promotions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setPromotions(promosData ?? []);
    setLoadingPromotions(false);
  };

  const handleDeleteRelease = async (releaseId: string, title: string) => {
    if (!user) return;
    const confirmed = window.confirm(`Are you sure you want to delete "${title}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("music_releases")
      .delete()
      .eq("id", releaseId)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Release deleted", description: `"${title}" was removed successfully.` });
    fetchUserData(user.id);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(true);
    fetchUserData(user.id).finally(() => setLoading(false));
    fetchPromotions(user.id);

    const channel = supabase
      .channel(`dashboard-release-progress-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "music_releases",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchUserData(user.id);
        }
      )
      .subscribe();

    const notifChannel = supabase
      .channel(`dashboard-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchNotifications(user.id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(notifChannel);
    };
  }, [user, authLoading, navigate]);

  const filteredReleases = useMemo(() => {
    let list = releases;
    if (activeTab === "drafts") {
      list = releases.filter((r) => r.status === "draft" || r.status === "unpaid");
    } else if (activeTab === "pending") {
      list = releases.filter((r) => ["pending", "under_review", "in_review", "processing", "queued"].includes((r.status || "").toLowerCase()));
    } else if (activeTab === "approved") {
      list = releases.filter((r) => ["approved", "live", "distributed", "delivered"].includes((r.status || "").toLowerCase()));
    } else if (activeTab === "uploaded") {
      list = releases;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      return (
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.artist_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [releases, searchQuery, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] text-foreground flex flex-col md:flex-row">
        <aside className="hidden md:flex w-64 bg-[#1b1e23] p-6 space-y-6">
          <Skeleton className="h-10 w-full bg-white/25" />
          <Skeleton className="h-16 w-full bg-white/15" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-full bg-white/15" />
            <Skeleton className="h-10 w-full bg-white/15" />
            <Skeleton className="h-10 w-full bg-white/15" />
          </div>
        </aside>
        <main className="flex-1 p-6 sm:p-10 space-y-8">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-300 space-y-4 shadow-sm">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </main>
      </div>
    );
  }

  const artistName = profile?.full_name || verification?.artist_name || user?.email?.split("@")[0] || "Artist";

  const draftCount = drafts.length + releases.filter((r) => r.status === "draft" || r.status === "unpaid").length;
  const pendingCount = releases.filter((r) => ["pending", "under_review", "in_review", "processing", "queued"].includes((r.status || "").toLowerCase())).length;
  const approvedCount = releases.filter((r) => ["approved", "live", "distributed", "delivered"].includes((r.status || "").toLowerCase())).length;
  const uploadedCount = releases.length;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#1b1e23] text-white">
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white text-black font-extrabold flex items-center justify-center text-lg shadow">
            ZB
          </div>
          <div>
            <p className="font-extrabold tracking-tight text-base leading-none text-white">zedBute</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 mt-1">Music Distribution</p>
          </div>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden text-white hover:text-white p-2 rounded-lg"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 mx-4 my-4 rounded-xl bg-white/10 border border-white/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center font-bold text-sm text-white shrink-0">
          {artistName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{artistName}</p>
          <p className="text-xs text-white/80 truncate">{user?.email}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 py-2 overflow-y-auto">
        <button
          onClick={() => { setActiveTab("dashboard"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors ${
            activeTab === "dashboard" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 text-white" />
          Overview & Analytics
        </button>
        <button
          onClick={() => { setActiveTab("albums"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors ${
            activeTab === "albums" ? "bg-[#ff6b35] text-white shadow-lg" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Disc className="h-4 w-4 text-white" />
          Albums / Releases
        </button>
        <button
          onClick={() => { setActiveTab("drafts"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors pl-11 ${
            activeTab === "drafts" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <FileEdit className="h-4 w-4 text-white" />
          Drafts ({draftCount})
        </button>
        <button
          onClick={() => { setActiveTab("pending"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors pl-11 ${
            activeTab === "pending" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Clock className="h-4 w-4 text-white" />
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => { setActiveTab("approved"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors pl-11 ${
            activeTab === "approved" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <CheckCircle className="h-4 w-4 text-white" />
          Approved ({approvedCount})
        </button>
        <button
          onClick={() => { setActiveTab("uploaded"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors pl-11 ${
            activeTab === "uploaded" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <CloudUpload className="h-4 w-4 text-white" />
          Uploaded ({uploadedCount})
        </button>
        <button
          onClick={() => { setActiveTab("notifications"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-none text-sm font-semibold transition-colors ${
            activeTab === "notifications" ? "bg-[#ff6b35] text-white shadow-lg" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-white" />
            <span>Notifications</span>
          </div>
          {unreadNotifCount > 0 && (
            <span className="bg-white text-black text-xs font-black px-2 py-0.5 rounded-none">
              {unreadNotifCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab("wallet"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors ${
            activeTab === "wallet" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Wallet className="h-4 w-4 text-white" />
          Royalty Wallet
        </button>
        <button
          onClick={() => { setActiveTab("verification"); setMobileSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-none text-sm font-semibold transition-colors ${
            activeTab === "verification" ? "bg-white/20 text-white shadow" : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <BadgeCheck className="h-4 w-4 text-white" />
          Artist Verification
        </button>
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-none text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-colors"
        >
          <HelpCircle className="h-4 w-4 text-white" />
          Back to Homepage
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>ZedBute | Dashboard</title>
        <meta name="description" content="Manage your music releases and distribution." />
      </Helmet>

      <div className="min-h-screen bg-[#f8f9fa] text-foreground flex flex-col md:flex-row relative">
        
        {/* Desktop Left Sidebar */}
        <aside className="hidden md:flex w-64 bg-[#1b1e23] text-white flex-col shrink-0 min-h-screen border-r border-white/15 sticky top-0 h-screen overflow-y-auto">
          {sidebarContent}
        </aside>

        {/* Mobile Slide-over Sidebar Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-[#1b1e23] text-white flex flex-col h-full shadow-2xl z-10 animate-slide-in">
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Right Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          
          {/* Top header bar */}
          <header className="bg-white border-b border-border/60 h-20 px-4 sm:px-10 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-2.5 rounded-none bg-gray-100 text-black hover:bg-gray-200 transition-colors"
                aria-label="Open navigation sidebar"
              >
                <Menu className="h-5 w-5 text-black" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-black shrink-0 hidden sm:block font-bold" />
                <Input
                  placeholder="Type song, artist or album..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-gray-300 bg-gray-50 text-black placeholder:text-gray-500 font-medium rounded-none focus-visible:ring-2 text-sm h-10 w-full px-4"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("notifications")}
                className={`relative p-2.5 rounded-none border transition-colors flex items-center justify-center ${
                  activeTab === "notifications"
                    ? "bg-[#ff6b35] text-white border-[#ff6b35]"
                    : "bg-white text-black border-gray-300 hover:border-black"
                }`}
                aria-label="View notifications"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-black text-white text-[10px] font-black w-5 h-5 rounded-none flex items-center justify-center border border-white">
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/upload-release")}
                className="rounded-none font-extrabold text-xs gap-1.5 bg-black text-white hover:bg-gray-800 h-10 px-4 sm:px-5 shrink-0 shadow"
              >
                <Plus className="h-4 w-4 text-white" /> <span className="hidden sm:inline text-white">Add Release</span><span className="sm:hidden text-white">Add</span>
              </Button>
            </div>
          </header>

          <div className="p-4 sm:p-10 space-y-8 max-w-7xl mx-auto w-full">

            {/* Top Status Summary Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              
              {/* Drafts Summary Card */}
              <div
                onClick={() => setActiveTab("drafts")}
                className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between ${
                  activeTab === "drafts"
                    ? "bg-[#ff6b35] text-white border-[#ff6b35] shadow-lg"
                    : "bg-white text-black border-gray-300 hover:border-black/50 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold ${activeTab === "drafts" ? "bg-white/25 text-white" : "bg-gray-100 text-black"}`}>
                    <FileEdit className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black">{draftCount}</span>
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${activeTab === "drafts" ? "text-white" : "text-black"}`}>Drafts</p>
                  <p className={`text-[11px] font-bold mt-0.5 ${activeTab === "drafts" ? "text-white/90" : "text-gray-600"}`}>Unfinished</p>
                </div>
              </div>

              {/* Pending Summary Card */}
              <div
                onClick={() => setActiveTab("pending")}
                className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between ${
                  activeTab === "pending"
                    ? "bg-[#ff6b35] text-white border-[#ff6b35] shadow-lg"
                    : "bg-white text-black border-gray-300 hover:border-black/50 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold ${activeTab === "pending" ? "bg-white/25 text-white" : "bg-gray-100 text-black"}`}>
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black">{pendingCount}</span>
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${activeTab === "pending" ? "text-white" : "text-black"}`}>Pending</p>
                  <p className={`text-[11px] font-bold mt-0.5 ${activeTab === "pending" ? "text-white/90" : "text-gray-600"}`}>In review</p>
                </div>
              </div>

              {/* Approved Summary Card */}
              <div
                onClick={() => setActiveTab("approved")}
                className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between ${
                  activeTab === "approved"
                    ? "bg-[#ff6b35] text-white border-[#ff6b35] shadow-lg"
                    : "bg-white text-black border-gray-300 hover:border-black/50 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold ${activeTab === "approved" ? "bg-white/25 text-white" : "bg-gray-100 text-black"}`}>
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black">{approvedCount}</span>
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${activeTab === "approved" ? "text-white" : "text-black"}`}>Approved</p>
                  <p className={`text-[11px] font-bold mt-0.5 ${activeTab === "approved" ? "text-white/90" : "text-gray-600"}`}>Live stores</p>
                </div>
              </div>

              {/* Uploaded Summary Card */}
              <div
                onClick={() => setActiveTab("uploaded")}
                className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between ${
                  activeTab === "uploaded"
                    ? "bg-[#ff6b35] text-white border-[#ff6b35] shadow-lg"
                    : "bg-white text-black border-gray-300 hover:border-black/50 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold ${activeTab === "uploaded" ? "bg-white/25 text-white" : "bg-gray-100 text-black"}`}>
                    <CloudUpload className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-xl sm:text-2xl font-black">{uploadedCount}</span>
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${activeTab === "uploaded" ? "text-white" : "text-black"}`}>Uploaded</p>
                  <p className={`text-[11px] font-bold mt-0.5 ${activeTab === "uploaded" ? "text-white/90" : "text-gray-600"}`}>Total</p>
                </div>
              </div>

              {/* Add an album action card */}
              <div
                onClick={() => navigate("/upload-release")}
                className="cursor-pointer rounded-2xl p-4 sm:p-5 border border-dashed border-black/40 bg-white text-black hover:border-black transition-all duration-300 flex flex-col items-center justify-center text-center group shadow-sm col-span-2 sm:col-span-1"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black text-white flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <p className="text-sm font-black text-black mt-1">Add an album</p>
                <p className="text-[11px] font-bold text-gray-600">Single, EP or LP</p>
              </div>

            </div>

            {/* Main Content Sections based on active tab */}
            {activeTab === "wallet" ? (
              <Card className="bg-white border border-border rounded-none shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Wallet className="h-6 w-6 text-black" />
                  <h2 className="text-xl font-bold text-black">Royalty Wallet & Payouts</h2>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-6">Track your streaming earnings and request instant payouts to MTN Mobile Money or Airtel Money.</p>
                <Button
                  onClick={() => navigate("/dashboard/royalties")}
                  className="rounded-none bg-black text-white hover:bg-gray-800 font-bold px-8"
                >
                  <Wallet className="h-4 w-4 mr-2 text-white" /> View Wallet & Request Payout
                </Button>
              </Card>
            ) : activeTab === "verification" ? (
              <Card className="bg-white border border-border rounded-none shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BadgeCheck className="h-6 w-6 text-black" />
                  <h2 className="text-xl font-bold text-black">Artist Verification</h2>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-6">Claim your Spotify and Boomplay artist profiles to unlock verified badge status.</p>
                <div className="space-y-4 max-w-md">
                  <Button
                    onClick={() => navigate("/boomplay-claim")}
                    className="w-full rounded-none bg-black text-white hover:bg-gray-800 font-bold"
                  >
                    Claim on Boomplay
                  </Button>
                  <Button
                    onClick={() => navigate("/spotify-claim")}
                    variant="outline"
                    className="w-full rounded-none font-bold text-black border-black/30 hover:bg-gray-100"
                  >
                    Claim Your Spotify Artist Profile
                  </Button>
                </div>
              </Card>
            ) : activeTab === "notifications" ? (
              <Card className="bg-white border border-gray-300 rounded-none shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-white rounded-none flex items-center justify-center shrink-0">
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-black">Artist Notifications & Alerts</h2>
                      <p className="text-xs font-semibold text-gray-600 mt-0.5">
                        Real-time status updates on your release approvals, rejections, live deliveries, and payment confirmations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (user) {
                          void fetchNotifications(user.id);
                          void refreshSubmissionStatuses(true);
                        }
                      }}
                      className="rounded-none font-bold text-xs border-gray-300 text-black hover:bg-gray-100 h-9"
                    >
                      Refresh
                    </Button>
                    {unreadNotifCount > 0 && (
                      <Button
                        size="sm"
                        onClick={handleMarkAllNotificationsRead}
                        className="rounded-none font-black text-xs bg-black text-white hover:bg-gray-800 h-9"
                      >
                        <Check className="h-4 w-4 mr-1 text-white" /> Mark All Read
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sub-filter tabs */}
                <div className="flex items-center gap-2 border-b border-gray-200 py-3 overflow-x-auto">
                  <button
                    onClick={() => setNotificationFilter("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors ${
                      notificationFilter === "all"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotificationFilter("unread")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors ${
                      notificationFilter === "unread"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    Unread ({unreadNotifCount})
                  </button>
                  <button
                    onClick={() => setNotificationFilter("releases")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors ${
                      notificationFilter === "releases"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    Release Updates ({notifications.filter(n => n.type === "release_status" || n.type === "once_submission").length})
                  </button>
                  <button
                    onClick={() => setNotificationFilter("payments")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-none transition-colors ${
                      notificationFilter === "payments"
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    Payments ({notifications.filter(n => n.type === "payment_confirmation").length})
                  </button>
                </div>

                {/* Notifications list */}
                <div className="mt-4 space-y-3">
                  {notifications.filter((n) => {
                    if (notificationFilter === "unread") return !n.is_read;
                    if (notificationFilter === "releases") return n.type === "release_status" || n.type === "once_submission";
                    if (notificationFilter === "payments") return n.type === "payment_confirmation";
                    return true;
                  }).length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                      <Bell className="mx-auto h-10 w-10 text-gray-400" />
                      <p className="text-sm font-bold text-black">No notifications found.</p>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        You will receive instant alerts here whenever a release is approved, rejected with reasons, delivered live to stores, or when a payment is confirmed.
                      </p>
                    </div>
                  ) : (
                    notifications
                      .filter((n) => {
                        if (notificationFilter === "unread") return !n.is_read;
                        if (notificationFilter === "releases") return n.type === "release_status" || n.type === "once_submission";
                        if (notificationFilter === "payments") return n.type === "payment_confirmation";
                        return true;
                      })
                      .map((n) => {
                        const isUnread = !n.is_read;
                        const isRejection = (n.title || "").toLowerCase().includes("rejected") || (n.title || "").toLowerCase().includes("attention") || (n.title || "").toLowerCase().includes("action required");
                        const isApprovalOrLive = (n.title || "").toLowerCase().includes("approved") || (n.title || "").toLowerCase().includes("live");
                        const isPayment = n.type === "payment_confirmation" || (n.title || "").toLowerCase().includes("payment");

                        return (
                          <div
                            key={n.id}
                            className={`p-4 border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                              isUnread
                                ? "bg-orange-50/50 border-[#ff6b35]/50 shadow-sm"
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div
                                className={`w-9 h-9 rounded-none flex items-center justify-center shrink-0 mt-0.5 ${
                                  isRejection
                                    ? "bg-red-600 text-white"
                                    : isApprovalOrLive
                                    ? "bg-green-600 text-white"
                                    : isPayment
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-800 text-white"
                                }`}
                              >
                                {isRejection ? (
                                  <AlertCircle className="h-5 w-5" />
                                ) : isApprovalOrLive ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : isPayment ? (
                                  <Wallet className="h-5 w-5" />
                                ) : (
                                  <Bell className="h-5 w-5" />
                                )}
                              </div>
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-black text-sm text-black leading-tight">
                                    {n.title}
                                  </h4>
                                  {isUnread && (
                                    <span className="bg-[#ff6b35] text-white text-[10px] font-black uppercase px-1.5 py-0.5 rounded-none">
                                      New
                                    </span>
                                  )}
                                  <span className="text-[11px] font-semibold text-gray-500">
                                    {n.created_at ? formatUpdated(n.created_at) : ""}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-gray-800 leading-relaxed">
                                  {n.message}
                                </p>
                                {n.metadata?.reason && (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-900 text-xs font-semibold rounded-none">
                                    <span className="font-black">Rejection Reason:</span> {String(n.metadata.reason)}
                                  </div>
                                )}
                                {Array.isArray(n.metadata?.storeNames) && n.metadata.storeNames.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    <span className="text-[11px] font-bold text-gray-600">Stores:</span>
                                    {n.metadata.storeNames.map((st: string) => (
                                      <span key={st} className="bg-gray-100 text-black border border-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-none">
                                        {st}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {n.metadata?.transactionId && (
                                  <p className="text-[11px] font-mono font-bold text-gray-600 mt-1">
                                    Ref: {String(n.metadata.transactionId)} &bull; Amount: K{String(n.metadata.amount || "")} ZMW
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 sm:self-center">
                              {isRejection && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (n.metadata?.releaseId) {
                                      navigate(`/upload-release?id=${encodeURIComponent(String(n.metadata.releaseId))}`);
                                    } else {
                                      navigate("/upload-release");
                                    }
                                  }}
                                  className="rounded-none font-bold text-xs bg-red-600 hover:bg-red-700 text-white h-8 px-3"
                                >
                                  Fix Release
                                </Button>
                              )}
                              {isUnread && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkNotificationRead(n.id)}
                                  className="rounded-none font-bold text-xs border-gray-300 text-black hover:bg-gray-100 h-8 px-3"
                                >
                                  Mark Read
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </Card>
            ) : (
              <>
                {/* Unfinished Drafts Section */}
                {drafts.length > 0 && activeTab === "drafts" && (
                  <div className="bg-white rounded-2xl border border-gray-300 shadow-sm p-6 mb-6 space-y-4">
                    <h3 className="text-lg font-extrabold text-black">Unfinished Drafts</h3>
                    <div className="space-y-3">
                      {drafts.map((d) => (
                        <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
                          <div className="flex items-center gap-3">
                            {d.cover_art_url ? (
                              <img src={d.cover_art_url} alt={d.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                <Music className="h-5 w-5 text-black" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-black truncate">{d.title || "Untitled Draft"}</p>
                              <p className="text-xs font-semibold text-gray-700">Step {d.current_step || 1} of 5 &bull; {d.primary_artist || "Artist pending"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" onClick={() => navigate(`/upload-release?draftId=${encodeURIComponent(d.id)}`)} className="rounded-full bg-black text-white text-xs font-bold">
                              Resume Draft
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteDraft(d.id, d.title || "Untitled")} className="text-red-600 hover:bg-red-50 font-bold">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Albums / Releases Table Card */}
                <div className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-xl font-black text-black capitalize">
                        {activeTab === "albums" ? "All Releases & Albums" : `${activeTab} Releases`}
                      </h2>
                      <p className="text-xs font-semibold text-gray-600 mt-0.5">Manage your digital music catalog across 150+ stores</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-bold text-black border-black/30 px-3 py-1">
                      {filteredReleases.length} {filteredReleases.length === 1 ? "Release" : "Releases"}
                    </Badge>
                  </div>

                  {filteredReleases.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <Disc className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="text-sm font-bold text-black">No releases found in this category.</p>
                      <Button onClick={() => navigate("/upload-release")} className="rounded-full bg-black text-white text-xs font-bold px-6">
                        <Plus className="h-4 w-4 mr-1.5 text-white" /> Upload First Release
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-100">
                          <TableRow>
                            <TableHead className="w-12 text-black font-extrabold">#</TableHead>
                            <TableHead className="text-black font-extrabold">Album/Artist</TableHead>
                            <TableHead className="hidden sm:table-cell text-black font-extrabold">Partner</TableHead>
                            <TableHead className="hidden md:table-cell text-black font-extrabold">Label</TableHead>
                            <TableHead className="hidden lg:table-cell text-black font-extrabold">UPC/EAN</TableHead>
                            <TableHead className="text-black font-extrabold">Created</TableHead>
                            <TableHead className="text-right text-black font-extrabold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReleases.map((r, idx) => (
                            <TableRow
                              key={r.id}
                              className="hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => {
                                if (r.status === "unpaid") {
                                  navigate(`/payment?type=release&releaseId=${r.id}`);
                                } else {
                                  openDistributionModal(r);
                                }
                              }}
                            >
                              <TableCell className="font-mono text-xs text-black font-bold">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {r.cover_art_url ? (
                                    <img src={r.cover_art_url} alt={r.title} className="w-11 h-11 rounded-lg object-cover shadow-sm shrink-0" />
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                      <Music className="h-5 w-5 text-black" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-black text-sm truncate text-black">{r.title}</p>
                                    <p className="text-xs font-semibold text-gray-700 truncate">{r.artist_name}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-bold text-gray-800 hidden sm:table-cell">
                                ZedBute Music
                              </TableCell>
                              <TableCell className="text-xs font-bold text-gray-800 hidden md:table-cell">
                                {profile?.full_name || "Independent"}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-bold text-gray-800 hidden lg:table-cell">
                                17364354{idx + 37}
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-gray-700">
                                {r.updated_at ? formatUpdated(r.updated_at) : "—"}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                                  {r.status === "unpaid" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => navigate(`/payment?type=release&releaseId=${r.id}`)}
                                      className="h-8 px-4 rounded-full bg-black text-white text-xs font-bold"
                                    >
                                      Pay Now
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openDistributionModal(r)}
                                        className="h-8 px-2.5 sm:px-3 rounded-full text-xs font-bold text-black border-black/40 bg-white hover:bg-gray-100 shadow-sm"
                                      >
                                        Engine
                                      </Button>
                                      {onceReleasesMap[r.id]?.once_release_id && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openReleaseAnalytics(onceReleasesMap[r.id].once_release_id!)}
                                          className="h-8 px-2.5 sm:px-3 rounded-full text-xs font-bold text-black border-black/40 bg-white hover:bg-gray-100 shadow-sm hidden sm:inline-flex"
                                        >
                                          Analytics
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate(`/upload-release?id=${r.id}`)}
                                        className="h-8 px-3 sm:px-4 rounded-full text-xs font-black bg-[#ff6b35]/15 text-[#ff6b35] border-[#ff6b35]/40 hover:bg-[#ff6b35]/25 shadow-sm"
                                      >
                                        EDIT
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Submission Tracker & Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                  <ReleaseSubmissionTracker
                    musicReleases={releases}
                    onceReleases={onceReleasesList}
                    syncing={syncingStatuses}
                    lastSyncedAt={lastStatusSyncAt}
                    onRefreshAll={() => refreshSubmissionStatuses(true)}
                    onSyncSingle={syncSingleOnceRelease}
                    onOpenDetails={(engineRec) => {
                      setActiveEngineRelease(engineRec);
                      setEngineModalOpen(true);
                    }}
                    onPayNow={(releaseId) => navigate(`/payment?type=release&releaseId=${releaseId}`)}
                    onResumeDraft={(draftId) => navigate(`/upload-release?draftId=${encodeURIComponent(draftId)}`)}
                  />

                  <div id="artist-analytics" className="scroll-mt-20">
                    <ArtistAnalyticsSection externalReleaseId={selectedAnalyticsReleaseId} />
                  </div>
                </div>
              </>
            )}

          </div>
        </main>

      </div>

      <DistributionEngineModal
        open={engineModalOpen}
        onOpenChange={setEngineModalOpen}
        release={activeEngineRelease}
        onUpdate={() => {
          if (user) fetchUserData(user.id);
        }}
      />
    </>
  );
};

export default Dashboard;
