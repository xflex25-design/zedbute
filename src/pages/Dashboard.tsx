import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Disc,
  Music,
  Plus,
  Upload,
} from "lucide-react";

// Mock releases data
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

const verificationBadge = (status: string | null) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Verified</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Pending Review</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Rejected</Badge>;
    default:
      return <Badge className="bg-gray-500/15 text-gray-500 border-gray-500/30">Not Applied</Badge>;
  }
};

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return;
      if (session) {
        setUser(session.user);
        Promise.all([
          supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
          supabase.from("artist_verifications").select("status, artist_name").eq("user_id", session.user.id).maybeSingle(),
        ]).then(([{ data: profileData }, { data: verificationData }]) => {
          if (!ignore) {
            setProfile(profileData);
            setVerification(verificationData);
            setLoading(false);
          }
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
        supabase.from("artist_verifications").select("status, artist_name").eq("user_id", session.user.id).maybeSingle().then(({ data }) => setVerification(data));
      } else if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

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

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-2xl">

        {/* Welcome header */}
        <div className="mb-6 mt-4">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Welcome{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your music distribution and verification status
          </p>
        </div>

        {/* Verification Status card */}
        <Card className="mb-4 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Music className="h-5 w-5 text-foreground" />
            <h2 className="text-base font-semibold">Verification Status</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Artist verification information</p>

          {verification ? (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                {verificationBadge(verification.status)}
                {verification.artist_name && (
                  <span className="text-sm text-muted-foreground">{verification.artist_name}</span>
                )}
              </div>
              {verification.status === "pending" && (
                <p className="text-xs text-muted-foreground">Your application is under review. We'll notify you once it's processed.</p>
              )}
              {verification.status === "approved" && (
                <p className="text-xs text-green-600">You are a verified artist. Premium distribution features are unlocked.</p>
              )}
              {verification.status === "rejected" && (
                <p className="text-xs text-red-500">Your application was rejected. You may reapply with updated information.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              Get verified to unlock premium distribution features
            </p>
          )}

          {(!verification || verification.status === "rejected") && (
            <Button
              onClick={() => navigate("/verify-claim")}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Apply for Verification
            </Button>
          )}
        </Card>

        {/* Quick Actions card */}
        <Card className="mb-4 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="h-5 w-5 text-foreground" />
            <h2 className="text-base font-semibold">Quick Actions</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Manage your music</p>

          <div className="space-y-2">
            <button
              onClick={() => navigate("/upload-release")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-left"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              Upload New Release
            </button>
            <button
              onClick={() => navigate("/verify-claim")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-left"
            >
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
              Get Verified
            </button>
          </div>
        </Card>

        {/* Your Releases */}
        <Card className="bg-card border border-border rounded-2xl">
          <div className="p-5">
            <div className="flex items-center justify-between mb-1 gap-3">
              <div className="flex items-center gap-2">
                <Disc className="h-5 w-5 text-foreground" />
                <h2 className="text-base font-semibold">Your Releases</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/upload-release")}
                className="rounded-lg text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">All submitted releases</p>

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
