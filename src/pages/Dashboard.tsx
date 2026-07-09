import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  CreditCard,
  Disc,
  Music,
  Plus,
  Upload,
  TrendingUp,
  ArrowUpRight,
  Download,
  Filter,
  Wallet,
} from "lucide-react";

type Release = {
  id: string;
  title: string;
  artist_name: string;
  release_type: string | null;
  release_date: string | null;
  cover_art_url: string | null;
  status: string | null;
  genre: string | null;
};

const statusVariant = (status: string | null) => {
  switch (status) {
    case "live":
    case "distributed":
      return "bg-green-500/15 text-green-600 border-green-500/30";
    case "processing":
      return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
    case "unpaid":
    case "pending":
      return "bg-gray-500/15 text-gray-500 border-gray-500/30";
    case "rejected":
      return "bg-red-500/15 text-red-600 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const statusLabel = (status: string | null) => {
  switch (status) {
    case "live": return "Live";
    case "distributed": return "Distributed";
    case "processing": return "Processing";
    case "unpaid": return "Unpaid";
    case "pending": return "Pending";
    case "rejected": return "Rejected";
    default: return status ?? "Unknown";
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
  const { user, loading: authLoading } = useAuth();
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
  const navigate = useNavigate();
  const { toast } = useToast();

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
          .select("id, title, artist_name, release_type, release_date, cover_art_url, status, genre")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

    setProfile(profileData);
    setVerification(verificationData);
    setReleases(releasesData ?? []);
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

  const handlePromote = async (releaseId: string) => {
    if (!user) return;
    setSubmittingPromo(true);
    const { data: promo, error } = await supabase
      .from("promotions")
      .insert({
        user_id: user.id,
        release_id: releaseId,
        amount: 20.00,
        status: "pending",
        social_handles: promoSocials,
        target_audience: promoAudience,
        message: promoMessage,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Promotion submitted!", description: "Complete the K20 payment to activate your promotion." });
      setShowPromoForm(false);
      setPromoSocials("");
      setPromoAudience("");
      setPromoMessage("");
      setPromotingReleaseId(null);
      navigate(`/payment?type=promotion&promotionId=${promo.id}`);
    }
    setSubmittingPromo(false);
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
  }, [user, authLoading, navigate]);

  const filteredReleases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return releases;
    return releases.filter((r) => {
      return (
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.artist_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [releases, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
const firstName = profile?.full_name?.split(" ")[0] ?? "";

return (
  <>
    <Helmet>
      <title>ZedBute | Dashboard</title>
      <meta
        name="description"
        content="Manage your releases, payments, and artist profile from the ZedBute dashboard."
      />
      <link
        rel="canonical"
        href="https://www.zedbute.com/"
      />
    </Helmet>

    <div className="min-h-screen bg-background">
      <Navbar />
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
        <Card className="mb-4 bg-card border border-border rounded-lg">
          <div className="p-5">
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
                <p className="text-xs text-muted-foreground">
                  Your application is under review. We'll notify you once it's processed.
                </p>
              )}
              {verification.status === "approved" && (
                <p className="text-xs text-green-600">
                  You are a verified artist. Premium distribution features are unlocked.
                </p>
              )}
              {verification.status === "rejected" && (
                <p className="text-xs text-red-500">
                  Your application was rejected. You may reapply with updated information.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              Get verified to unlock premium distribution features
            </p>
          )}

          {(!verification || verification.status === "rejected") && (
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/payment?type=boomplay-claim&amount=20")}
                className="w-full rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-all duration-200"
              >
                Claim on Boomplay
              </Button>
              <Button
                onClick={() => navigate("/spotify-claim")}
                variant="outline"
                className="w-full rounded-lg font-semibold transition-all duration-200"
              >
                Claim Your Spotify Artist Profile
              </Button>
            </div>
          )}
          </div>
        </Card>

        {/* Quick Actions card */}
        <Card className="mb-4 bg-card border border-border rounded-lg">
          <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="h-5 w-5 text-foreground" />
            <h2 className="text-base font-semibold">Quick Actions</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Manage your music</p>

          <div className="space-y-2">
            <button
              onClick={() => navigate("/upload-release")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-left"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              Upload Single
            </button>
            <button
              onClick={() => navigate("/upload-ep")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-left"
            >
              <Music className="h-4 w-4 text-muted-foreground" />
              Upload EP
            </button>
            <button
              onClick={() => navigate("/upload-album")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-left"
            >
              <Disc className="h-4 w-4 text-muted-foreground" />
              Upload Album
            </button>
          </div>
          </div>
        </Card>

        <Card className="mb-4 bg-card border border-border rounded-lg">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="h-5 w-5 text-foreground" />
              <h2 className="text-base font-semibold">Manage Royalties</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Go to settings to request withdrawals and view royalty history.</p>
            <Button
              onClick={() => navigate("/settings")}
              className="w-full rounded-lg bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-all duration-200"
            >
              Request Withdrawal in Settings
            </Button>
          </div>
        </Card>

        <Card className="bg-card border border-border rounded-lg">
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

            {/* Unpaid releases banner */}
            {releases.some((r) => r.status === "unpaid") && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <CreditCard className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-600">Payment required</p>
                  <p className="text-xs text-amber-600/80 mt-0.5">
                    You have unpaid releases. Click <strong>Pay Now</strong> to complete your submission.
                  </p>
                </div>
              </div>
            )}

            {releases.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Disc className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No releases yet</p>
                <Button
                  size="sm"
                  onClick={() => navigate("/upload-release")}
                  className="rounded-lg bg-gradient-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Upload your first release
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <Label htmlFor="release-search" className="block text-sm font-medium text-foreground mb-2">
                    Search releases
                  </Label>
                  <Input
                    id="release-search"
                    className="w-full"
                    placeholder="Search title or artist"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {filteredReleases.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <p className="text-sm text-muted-foreground">No releases match your search.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop: Table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cover</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Release Date</TableHead>
                            <TableHead>Genre</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReleases.map((r) => (
                            <TableRow
                              key={r.id}
                              className={r.status === "unpaid" ? "cursor-pointer hover:bg-amber-500/5" : ""}
                              onClick={r.status === "unpaid" ? () => navigate(`/payment?type=release&releaseId=${r.id}`) : undefined}
                            >
                              <TableCell>
                                {r.cover_art_url ? (
                                  <img
                                    src={r.cover_art_url}
                                    alt={r.title}
                                    className="w-10 h-10 rounded object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                    <Music className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">{r.title}</p>
                                <p className="text-xs text-muted-foreground">{r.artist_name}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {r.release_type ?? "Single"}
                                </Badge>
                              </TableCell>
                              <TableCell>{r.release_date ?? "—"}</TableCell>
                              <TableCell>{r.genre ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge className={statusVariant(r.status)}>
                                    {statusLabel(r.status)}
                                  </Badge>
                                  {r.status === "unpaid" && (
                                    <Button
                                      size="sm"
                                      className="h-6 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/payment?type=release&releaseId=${r.id}`);
                                      }}
                                    >
                                      <CreditCard className="h-3 w-3 mr-1" />
                                      Pay Now
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile: Cards  */}
                    <div className="md:hidden space-y-4">
                      {filteredReleases.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-lg border bg-background p-4 space-y-3 ${
                            r.status === "unpaid"
                              ? "border-amber-500/40 cursor-pointer active:bg-amber-500/5"
                              : "border-border"
                          }`}
                          onClick={r.status === "unpaid" ? () => navigate(`/payment?type=release&releaseId=${r.id}`) : undefined}
                        >
                          <div className="flex items-start gap-3">
                            {r.cover_art_url ? (
                              <img
                                src={r.cover_art_url}
                                alt={r.title}
                                className="w-14 h-14 rounded object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                                <Music className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{r.title}</p>
                              <p className="text-sm text-muted-foreground">{r.artist_name}</p>
                            </div>
                            <Badge className={statusVariant(r.status)}>
                              {statusLabel(r.status)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Type</p>
                              <p className="font-medium capitalize">{r.release_type ?? "Single"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Release Date</p>
                              <p className="font-medium">{r.release_date ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Genre</p>
                              <p className="font-medium">{r.genre ?? "—"}</p>
                            </div>
                          </div>
                          {r.status === "unpaid" && (
                            <Button
                              size="sm"
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/payment?type=release&releaseId=${r.id}`);
                              }}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Complete Payment — K50
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Promote Your Releases */}
        {releases.length > 0 && (
          <Card className="bg-card border border-border rounded-lg mt-6">
            <div className="p-5">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Promote Your Music
              </h2>
              <p className="text-xs text-muted-foreground mb-4">Pay K20 to get featured on our homepage AND Boomplay playlist</p>

              {!promotingReleaseId ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredReleases.map((r) => {
                    const isPromoted = promotions.some((p) => p.release_id === r.id && p.status === "active");
                    const hasPending = promotions.some((p) => p.release_id === r.id && p.status === "pending");
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {r.cover_art_url ? (
                            <img src={r.cover_art_url} alt={r.title} className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Music className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.title}</p>
                            <p className="text-xs text-muted-foreground">{r.status}</p>
                          </div>
                        </div>
                        {isPromoted ? (
                          <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Promoted</Badge>
                        ) : hasPending ? (
                          <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Pending</Badge>
                        ) : r.status !== "unpaid" ? (
                          <Button
                            size="sm"
                            onClick={() => setPromotingReleaseId(r.id)}
                            className="rounded-lg bg-gradient-primary text-primary-foreground text-xs"
                          >
                            Promote — K20
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pay to promote</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <p className="text-sm font-medium">Promote Release</p>
                  <p className="text-xs text-muted-foreground">Enter your details and pay K20 to get featured on the homepage AND Boomplay playlist for 7 days.</p>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="promoSocials">Social Handles (optional)</Label>
                      <Input id="promoSocials" placeholder="@artistname" value={promoSocials} onChange={(e) => setPromoSocials(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="promoAudience">Target Audience</Label>
                      <Input id="promoAudience" placeholder="e.g., Zambian music lovers, Hip Hop fans" value={promoAudience} onChange={(e) => setPromoAudience(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="promoMessage">Promotion Message</Label>
                      <Input id="promoMessage" placeholder="Check out my new release!" value={promoMessage} onChange={(e) => setPromoMessage(e.target.value)} />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => handlePromote(promotingReleaseId)} disabled={submittingPromo} className="flex-1 bg-gradient-primary text-primary-foreground">
                        {submittingPromo ? "Submitting..." : "Proceed to Pay K20"}
                      </Button>
                      <Button variant="outline" onClick={() => { setPromotingReleaseId(null); setShowPromoForm(false); }} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

      </div>
    </div>
  </>
  );
};

export default Dashboard;
