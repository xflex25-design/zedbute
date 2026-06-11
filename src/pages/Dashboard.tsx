import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Headphones,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

type Range = "7d" | "30d" | "12m";

// Mock stat cards data
const MOCK_STATS = {
  monthly_streams: 12847,
  monthly_listeners: 3254,
  estimated_royalties: 2450,
  total_releases: 5,
};

// Mock chart data
const DATA_12M = [
  { label: "Jan", streams: 820 },
  { label: "Feb", streams: 950 },
  { label: "Mar", streams: 1100 },
  { label: "Apr", streams: 980 },
  { label: "May", streams: 1250 },
  { label: "Jun", streams: 1400 },
  { label: "Jul", streams: 1180 },
  { label: "Aug", streams: 1350 },
  { label: "Sep", streams: 1520 },
  { label: "Oct", streams: 1100 },
  { label: "Nov", streams: 1380 },
  { label: "Dec", streams: 917 },
];

const DATA_30D = [
  { label: "1", streams: 320 },
  { label: "5", streams: 450 },
  { label: "10", streams: 380 },
  { label: "15", streams: 520 },
  { label: "20", streams: 610 },
  { label: "25", streams: 480 },
  { label: "30", streams: 387 },
];

const DATA_7D = [
  { label: "Mon", streams: 180 },
  { label: "Tue", streams: 220 },
  { label: "Wed", streams: 190 },
  { label: "Thu", streams: 280 },
  { label: "Fri", streams: 310 },
  { label: "Sat", streams: 250 },
  { label: "Sun", streams: 157 },
];

// Mock releases data with Zambian artist names
const MOCK_RELEASES = [
  { id: "1", title: "Location", artist: "Yo Maps", type: "Single", releaseDate: "2026-05-15", platforms: "Spotify, Apple Music, Boomplay", streams: 4523, cover: "https://images.unsplash.com/photo-1493225457124-a321fcb1b455?w=100&h=100&fit=crop", status: "Live" },
  { id: "2", title: "Bon Appétit", artist: "Chef 187", type: "EP", releaseDate: "2026-04-20", platforms: "Spotify, Apple Music, YouTube Music", streams: 3891, cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop", status: "Live" },
  { id: "3", title: "King Cobra", artist: "Slapdee", type: "Album", releaseDate: "2026-06-01", platforms: "Spotify, Apple Music, Boomplay, Deezer", streams: 2156, cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b645?w=100&h=100&fit=crop", status: "Processing" },
  { id: "4", title: "Money Maker", artist: "Macky 2", type: "Single", releaseDate: "2026-05-28", platforms: "Spotify, Apple Music", streams: 1872, cover: "https://images.unsplash.com/photo-1459749411175-04bf5ebc9e38?w=100&h=100&fit=crop", status: "Pending" },
  { id: "5", title: "Mr. Tay", artist: "Tay Grin", type: "Single", releaseDate: "2026-06-05", platforms: "Spotify, Boomplay, YouTube Music", streams: 405, cover: "https://images.unsplash.com/photo-1504898770365-14f4f50d6dd4?w=100&h=100&fit=crop", status: "Pending" },
];

const statusVariant = (status: string) => {
  switch (status) {
    case "Live":
      return "bg-green-500/15 text-green-600 border-green-500/30";
    case "Processing":
      return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
    case "Pending":
      return "bg-gray-500/15 text-gray-600 border-gray-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("12m");
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return;
      if (session) {
        setUser(session.user);
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(({ data }) => {
          setProfile(data);
          setLoading(false);
        });
      } else {
        setLoading(false);
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignore) return;
      if (session) {
        setUser(session.user);
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(({ data }) => setProfile(data));
      } else if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
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
        {/* Welcome header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your streams, listeners and earnings in real time.
          </p>
        </div>

        {/* Hero CTA - Create Artist */}
        <Button
          onClick={() => navigate("/verify-claim")}
          className="w-full mb-8 rounded-xl bg-gradient-primary px-6 py-5 text-base sm:text-lg font-bold text-primary-foreground shadow-glow hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Artist
        </Button>

        {/* Stat cards - 4 cards with alternating primary/secondary accents */}
        <div className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto sm:overflow-visible">
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-max sm:min-w-0">
            {[
              { label: "Monthly Streams", value: MOCK_STATS.monthly_streams.toLocaleString(), change: 12, icon: Headphones, accent: "bg-primary", tileClass: "bg-primary/10 text-primary" },
              { label: "Monthly Listeners", value: MOCK_STATS.monthly_listeners.toLocaleString(), change: 8, icon: Users, accent: "bg-secondary", tileClass: "bg-secondary/10 text-secondary" },
              { label: "Estimated Royalties ZMW", value: `K ${MOCK_STATS.estimated_royalties.toLocaleString()}`, change: 15, icon: Wallet, accent: "bg-primary", tileClass: "bg-primary/10 text-primary" },
              { label: "Total Releases", value: String(MOCK_STATS.total_releases), change: 0, icon: Disc, accent: "bg-secondary", tileClass: "bg-secondary/10 text-secondary" },
            ].map((s) => {
              const Icon = s.icon;
              const changeNum = Number(s.change) || 0;
              const positive = changeNum >= 0;
              return (
                <Card key={s.label} className="relative overflow-hidden bg-card shadow-card w-64 sm:w-auto shrink-0 snap-start">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.accent}`} />
                  <div className="p-4 flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.tileClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold leading-tight">{s.value}</p>
                      <div className="flex items-center gap-1 text-xs font-semibold mt-1 text-green-500">
                        <TrendingUp className="h-3 w-3" />
                        {positive ? "+" : ""}{changeNum}%
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

        {/* Releases section */}
        <Card className="bg-card shadow-card">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5 gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your Releases</h2>
                <p className="text-xs text-muted-foreground">All submitted releases</p>
              </div>
              <Button variant="hero" size="sm" onClick={() => navigate("/upload-release")}>
                <Plus className="h-4 w-4" />
                New Release
              </Button>
            </div>

            {/* Desktop: Table */}
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
                  {MOCK_RELEASES.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <img src={r.cover} alt={r.title} className="w-10 h-10 rounded object-cover" />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.artist}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.type}</Badge>
                      </TableCell>
                      <TableCell>{r.releaseDate}</TableCell>
                      <TableCell className="text-xs">{r.platforms}</TableCell>
                      <TableCell className="text-right font-medium">{r.streams.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={statusVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-4">
              {MOCK_RELEASES.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <img src={r.cover} alt={r.title} className="w-14 h-14 rounded object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-sm text-muted-foreground">{r.artist}</p>
                    </div>
                    <Badge className={statusVariant(r.status)}>{r.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium">{r.type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Release Date</p>
                      <p className="font-medium">{r.releaseDate}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Platforms</p>
                      <p className="font-medium text-xs">{r.platforms}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Streams</p>
                      <p className="font-medium">{r.streams.toLocaleString()}</p>
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
