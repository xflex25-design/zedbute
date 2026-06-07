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

const STATS = [
  {
    label: "Monthly Streams",
    value: "0",
    icon: Headphones,
    accent: "bg-primary",
    tileClass: "bg-primary/10 text-primary",
  },
  {
    label: "Monthly Listeners",
    value: "0",
    icon: Users,
    accent: "bg-secondary",
    tileClass: "bg-secondary/10 text-secondary",
  },
  {
    label: "Estimated Royalties",
    value: "K 0",
    icon: Wallet,
    accent: "bg-primary",
    tileClass: "bg-primary/10 text-primary",
  },
  {
    label: "Total Releases",
    value: "0",
    icon: Disc,
    accent: "bg-secondary",
    tileClass: "bg-secondary/10 text-secondary",
  },
];

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
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
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(data);
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
                      <p className="text-2xl font-bold leading-tight">{s.value}</p>
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

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cover</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Release Date</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead className="text-right">Streams</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RELEASES.map((r) => (
                    <TableRow key={r.title}>
                      <TableCell>
                        <div className="h-10 w-10 rounded-md bg-gradient-primary flex items-center justify-center">
                          <Disc className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{r.artist}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.date}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-xs text-muted-foreground">
                          <span>Spotify</span>·<span>Apple</span>·<span>TikTok</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{r.streams.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusVariant(r.status)}`}>
                          {r.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {RELEASES.map((r) => (
                <div key={r.title} className="rounded-lg border border-border p-3 flex gap-3">
                  <div className="h-14 w-14 rounded-md bg-gradient-primary flex items-center justify-center shrink-0">
                    <Disc className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.artist}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusVariant(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] py-0">{r.type}</Badge>
                        <span>{r.date}</span>
                      </div>
                      <span className="font-medium text-foreground">{r.streams.toLocaleString()} plays</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
