import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Disc,
  Download,
  Globe,
  Headphones,
  Music as MusicIcon,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";

type Range = "7d" | "30d" | "12m";

type Stats = {
  monthly_streams: number;
  monthly_listeners: number;
  estimated_royalties: number;
  streams_change_pct: number;
  listeners_change_pct: number;
  royalties_change_pct: number;
};

const DEFAULT_STATS: Stats = {
  monthly_streams: 0,
  monthly_listeners: 0,
  estimated_royalties: 0,
  streams_change_pct: 0,
  listeners_change_pct: 0,
  royalties_change_pct: 0,
};

const DATA_12M = [
  { label: "Jan", streams: 0 },
  { label: "Feb", streams: 0 },
  { label: "Mar", streams: 0 },
  { label: "Apr", streams: 0 },
  { label: "May", streams: 0 },
  { label: "Jun", streams: 0 },
  { label: "Jul", streams: 0 },
  { label: "Aug", streams: 0 },
  { label: "Sep", streams: 0 },
  { label: "Oct", streams: 0 },
  { label: "Nov", streams: 0 },
  { label: "Dec", streams: 0 },
];

const DATA_30D = Array.from({ length: 30 }, (_, i) => ({
  label: `${i + 1}`,
  streams: 0,
}));

const DATA_7D = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
  label: d,
  streams: 0,
}));

type Release = {
  id: string;
  title: string;
  artist_name: string;
  release_type: string | null;
  genre: string | null;
  release_date: string | null;
  cover_art_url: string | null;
  audio_url: string | null;
  language: string[] | null;
  status: string;
  created_at: string;
};

const statusVariant = (status: string) => {
  switch (status) {
    case "distributed":
      return "bg-green-500/15 text-green-600 border-green-500/30";
    case "processing":
      return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    case "pending":
      return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
    case "failed":
      return "bg-red-500/15 text-red-600 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const statusLabel = (status: string) => {
  if (status === "distributed") return "Delivered";
  if (status === "processing") return "Processing";
  if (status === "pending") return "Pending Review";
  if (status === "failed") return "Failed";
  return status;
};

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("12m");
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      const [{ data: profileData }, { data: releaseData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase
          .from("music_releases")
          .select("id,title,artist_name,release_type,genre,release_date,cover_art_url,audio_url,language,status,created_at")
          .eq("user_id", session.user.id)
          .neq("status", "unpaid")
          .order("created_at", { ascending: false }),
      ]);
      setProfile(profileData);
      setReleases((releaseData as Release[]) || []);
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setUser(s?.user ?? null);
      if (!s) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const chartData = useMemo(() => {
    if (range === "7d") return DATA_7D;
    if (range === "30d") return DATA_30D;
    return DATA_12M;
  }, [range]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your streams, listeners and earnings in real time.
          </p>
        </div>

        {/* Create Artist CTA */}
        <button
          onClick={() => navigate("/verify-claim")}
          className="w-full mb-8 rounded-2xl bg-gradient-primary px-6 py-5 text-base sm:text-lg font-bold text-primary-foreground shadow-glow hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Artist
        </button>

        {/* Stat cards */}
        <div className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto sm:overflow-visible">
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-max sm:min-w-0">
            {STATS.map((s) => {
              const displayValue = s.label === "Total Releases" ? String(releases.length) : s.value;
              const Icon = s.icon;
              return (
                <Card
                  key={s.label}
                  className="relative overflow-hidden bg-card shadow-card w-64 sm:w-auto shrink-0 snap-start"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${s.accent}`} />
                  <div className="p-5 flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${s.tileClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold leading-tight">{displayValue}</p>
                      <div className="flex items-center gap-1 text-xs text-green-500 font-semibold mt-1">
                        <TrendingUp className="h-3 w-3" />
                        0%
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.label} · vs previous period
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Streams chart */}
        <Card className="bg-card shadow-card mb-8">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold">Streams</h2>
                <p className="text-xs text-muted-foreground">
                  Listening trend across all platforms
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-background p-1 self-start">
                {([
                  ["7d", "7 Days"],
                  ["30d", "30 Days"],
                  ["12m", "12 Months"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRange(key)}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors ${
                      range === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="streamLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--secondary))" />
                    </linearGradient>
                    <linearGradient id="streamFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="streams"
                    stroke="url(#streamLine)"
                    strokeWidth={3}
                    fill="url(#streamFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Releases */}
        <Card className="bg-card shadow-card">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5 gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your Releases</h2>
                <p className="text-xs text-muted-foreground">Recently submitted music</p>
              </div>
              <Button variant="hero" size="sm" onClick={() => navigate("/upload-release")}>
                <Plus className="h-4 w-4" />
                New Release
              </Button>
            </div>

            {releases.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <Disc className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No releases yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Releases appear here after your payment is confirmed.
                </p>
                <Button variant="hero" size="sm" className="mt-4" onClick={() => navigate("/upload-release")}>
                  <Plus className="h-4 w-4" />
                  Upload your first release
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {releases.map((r) => {
                  const dateStr = r.release_date
                    ? format(new Date(r.release_date), "dd/MM/yyyy")
                    : format(new Date(r.created_at), "dd/MM/yyyy");
                  const typeLabel =
                    r.release_type === "ep" ? "EP" : r.release_type === "album" ? "Album" : "Single";
                  const languages = (r.language || []).join(", ") || "—";
                  return (
                    <div key={r.id} className="rounded-xl border border-border bg-background overflow-hidden">
                      {/* Top: cover + title + status */}
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                        <div className="h-32 w-32 sm:h-36 sm:w-36 rounded-lg overflow-hidden bg-muted shrink-0 mx-auto sm:mx-0">
                          {r.cover_art_url ? (
                            <img src={r.cover_art_url} alt={`${r.title} cover`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-primary flex items-center justify-center">
                              <Disc className="h-10 w-10 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusVariant(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                          <h3 className="text-xl font-bold mt-2 truncate">{r.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">{r.artist_name}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {typeLabel} · {r.genre || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Release information */}
                      <div className="border-t border-border px-4 sm:px-5 py-4">
                        <p className="text-sm font-semibold mb-3">Release information</p>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground">Title</dt>
                            <dd className="font-medium">{r.title}</dd>
                          </div>
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground">Language</dt>
                            <dd className="font-medium">{languages}</dd>
                          </div>
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground">Label</dt>
                            <dd className="font-medium">ZedBute</dd>
                          </div>
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground">Type</dt>
                            <dd className="font-medium">{typeLabel}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Track */}
                      <div className="border-t border-border px-4 sm:px-5 py-4">
                        <p className="text-sm font-semibold mb-3">Track</p>
                        <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <MusicIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">1. {r.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.artist_name}</p>
                          </div>
                          {r.audio_url && (
                            <a
                              href={r.audio_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Audio
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Distribution */}
                      <div className="border-t border-border px-4 sm:px-5 py-4">
                        <p className="text-sm font-semibold mb-3">Distribution options</p>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground">Release date</dt>
                            <dd className="font-medium">{dateStr}</dd>
                          </div>
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Countries</dt>
                            <dd className="font-medium">Worldwide</dd>
                          </div>
                          <div className="flex justify-between sm:block">
                            <dt className="text-muted-foreground">Platforms</dt>
                            <dd className="font-medium">Spotify, Apple Music, Boomplay, YouTube Music, Tidal, Deezer, Amazon Music</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
