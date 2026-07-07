import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Music, Youtube } from "lucide-react";

const LENCO_PUBLIC_KEY = "pub-6f90c9d7234ba5738a66ac8036942f6200ab2da1851e0e0c";

type Platform = "spotify" | "youtube";

const PLATFORM_CONFIG: Record<Platform, { label: string; amount: number; accent: string }> = {
  spotify: { label: "Spotify", amount: 50, accent: "bg-green-600 hover:bg-green-700 text-white" },
  youtube: { label: "YouTube OAC", amount: 260, accent: "bg-red-600 hover:bg-red-700 text-white" },
};

interface SpotifyForm {
  platformEmail: string;
  artistName: string;
  spotifyUrl: string;
  socialUrl: string;
  phone: string;
}
interface YouTubeForm {
  artistName: string;
  youtubeUrl: string;
  topicChannelUrl: string;
  distributorName: string;
  phone: string;
}

const DISTRIBUTORS = ["DistroKid", "TuneCore", "CD Baby", "ONErpm", "Other"];

const Verify = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [verifiedPlatforms, setVerifiedPlatforms] = useState<Set<Platform>>(new Set());
  const [loadingPlatform, setLoadingPlatform] = useState<Platform | null>(null);

  const [spotifyForm, setSpotifyForm] = useState<SpotifyForm>({
    platformEmail: "", artistName: "", spotifyUrl: "", socialUrl: "", phone: "",
  });
  const [youtubeForm, setYoutubeForm] = useState<YouTubeForm>({
    artistName: "", youtubeUrl: "", topicChannelUrl: "", distributorName: "", phone: "",
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(profileData);
      const ph = profileData?.phone_number || "";
      setSpotifyForm((f) => ({ ...f, phone: ph }));
      setYoutubeForm((f) => ({ ...f, phone: ph }));

      const { data: existing } = await supabase
        .from("artist_verifications")
        .select("platform")
        .eq("user_id", session.user.id);
      if (existing) {
        const set = new Set<Platform>();
        existing.forEach((r: any) => {
          if (r.platform === "spotify" || r.platform === "youtube") {
            set.add(r.platform);
          }
        });
        setVerifiedPlatforms(set);
      }
    };
    init();
  }, [navigate]);

  const validateSpotify = (f: SpotifyForm) => {
    if (!f.platformEmail.trim() || !f.artistName.trim() || !f.spotifyUrl.trim() || !f.phone.trim()) {
      return "Please fill all required fields";
    }
    return null;
  };
  const validateYouTube = (f: YouTubeForm) => {
    if (!f.artistName.trim() || !f.youtubeUrl.trim() || !f.topicChannelUrl.trim() || !f.distributorName.trim() || !f.phone.trim()) {
      return "Please fill all required fields";
    }
    return null;
  };

  const submitToDb = async (platform: Platform, payload: any, transactionId: string) => {
    const { amount } = PLATFORM_CONFIG[platform];
    const { error } = await supabase.from("artist_verifications").insert({
      user_id: user.id,
      platform,
      artist_name: payload.artist_name,
      platform_email: payload.platform_email ?? null,
      platform_user_id: payload.platform_user_id ?? null,
      spotify_url: payload.spotify_url ?? null,
      youtube_url: payload.youtube_url ?? null,
      topic_channel_url: payload.topic_channel_url ?? null,
      distributor_name: payload.distributor_name ?? null,
      instagram_url: payload.instagram_url ?? null,
      deposit_amount: amount,
      payment_status: "paid",
      payment_transaction_id: transactionId,
      payment_phone_number: payload.phone,
      status: "pending",
    } as any);
    if (error) throw error;
  };

  const runLencoPayment = async (platform: Platform, validate: () => string | null, buildPayload: () => any, phone: string) => {
    if (verifiedPlatforms.has(platform)) {
      toast({ title: "Already submitted", description: `Your ${PLATFORM_CONFIG[platform].label} verification is already in review.` });
      return;
    }
    const err = validate();
    if (err) {
      toast({ title: "Missing info", description: err, variant: "destructive" });
      return;
    }
    if (typeof LencoPay === "undefined") {
      toast({ title: "Payment unavailable", description: "Payment system is still loading. Please try again.", variant: "destructive" });
      return;
    }

    setLoadingPlatform(platform);
    const amount = PLATFORM_CONFIG[platform].amount;
    const reference = `verification-${platform}-${user.id}-${Date.now()}`;

    // Guards against onClose firing after a success/pending callback and
    // clobbering the success state with a "Payment cancelled" toast.
    let paymentHandled = false;

    // Pre-record verification payment so the DB trigger allows the verification insert
    const writePayment = async (status: "verified" | "pending") => {
      await supabase.from("release_payments").insert({
        user_id: user.id,
        amount,
        payment_method: "lenco_inline",
        phone_number: phone,
        transaction_id: reference,
        status,
        verified_at: status === "verified" ? new Date().toISOString() : null,
      });
    };

    const finalize = async (status: "verified" | "pending") => {
      try {
        await writePayment(status);
        await submitToDb(platform, buildPayload(), reference);
        setVerifiedPlatforms((prev) => new Set(prev).add(platform));
        toast({
          title: "Payment Confirmed via Lenco!",
          description: "Your request is being processed. 🚀",
        });
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Submission failed",
          description: e.message ?? "Could not save verification. Contact support.",
          variant: "destructive",
        });
      } finally {
        setLoadingPlatform(null);
      }
    };

    LencoPay.getPaid({
      key: LENCO_PUBLIC_KEY,
      reference,
      email: user.email,
      amount,
      currency: "ZMW",
      channels: ["card", "mobile-money"],
      customer: {
        firstName: profile?.full_name?.split(" ")[0] || "Customer",
        lastName: profile?.full_name?.split(" ").slice(1).join(" ") || "",
        phone,
      },
      onSuccess: async () => {
        if (paymentHandled) return;
        paymentHandled = true;
        await finalize("verified");
      },
      onConfirmationPending: () => {
        if (paymentHandled) return;
        paymentHandled = true;
        finalize("pending");
      },
      onClose: () => {
        setLoadingPlatform(null);
        if (paymentHandled) return;
        toast({ title: "Payment cancelled", description: "You closed the payment window. No charge was made." });
      },
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">Artist Verification Center</h1>
            <p className="text-muted-foreground">
              Choose your platform and pay securely via Lenco to start the verification process.
            </p>
          </div>

<Tabs defaultValue="spotify" className="w-full">
           <TabsList className="grid w-full grid-cols-2">
             <TabsTrigger value="spotify">Spotify</TabsTrigger>
             <TabsTrigger value="youtube" className="text-xs sm:text-sm">YouTube</TabsTrigger>
           </TabsList>

            {/* SPOTIFY */}
            <TabsContent value="spotify">
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Music className="h-5 w-5" /> Spotify Verification
                    </CardTitle>
                    <Badge className="bg-green-600 hover:bg-green-600 text-white">Processing Fee: K50 Kwacha via Lenco</Badge>
                  </div>
                  <CardDescription>Get your verified blue check on Spotify for Artists.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {verifiedPlatforms.has("spotify") && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-green-700 text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Submitted — in review
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Spotify Account Email *</Label>
                    <Input type="email" value={spotifyForm.platformEmail}
                      onChange={(e) => setSpotifyForm({ ...spotifyForm, platformEmail: e.target.value })}
                      placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Artist Name *</Label>
                    <Input value={spotifyForm.artistName}
                      onChange={(e) => setSpotifyForm({ ...spotifyForm, artistName: e.target.value })}
                      placeholder="Your Spotify artist name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Spotify Artist URI / URL *</Label>
                    <Input value={spotifyForm.spotifyUrl}
                      onChange={(e) => setSpotifyForm({ ...spotifyForm, spotifyUrl: e.target.value })}
                      placeholder="https://open.spotify.com/artist/..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Social Media Link (Instagram / Twitter)</Label>
                    <Input value={spotifyForm.socialUrl}
                      onChange={(e) => setSpotifyForm({ ...spotifyForm, socialUrl: e.target.value })}
                      placeholder="https://instagram.com/yourhandle" />
                  </div>
<div className="space-y-2">
                    <Label>Mobile Money / Payment Phone *</Label>
                    <Input type="tel" value={spotifyForm.phone}
                      onChange={(e) => setSpotifyForm({ ...spotifyForm, phone: e.target.value })}
                      placeholder="e.g. 0971234567"
                      className="h-10"
                    />
                  </div>
                  <Button
                    className={`w-full font-bold py-3 sm:py-4 text-sm sm:text-base ${PLATFORM_CONFIG.spotify.accent}`}
                    disabled={loadingPlatform !== null || verifiedPlatforms.has("spotify")}
                  >
                    {loadingPlatform === "spotify" ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing payment…</>
                    ) : "Pay K50 & Submit via Lenco"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* YOUTUBE */}
            <TabsContent value="youtube">
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Youtube className="h-5 w-5" /> YouTube Official Artist Channel
                    </CardTitle>
                    <Badge className="bg-red-600 hover:bg-red-600 text-white">Processing Fee: K260 Kwacha via Lenco</Badge>
                  </div>
                  <CardDescription>Apply for a YouTube Official Artist Channel (OAC).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {verifiedPlatforms.has("youtube") && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Submitted — in review
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>YouTube Channel Name *</Label>
                    <Input value={youtubeForm.artistName}
                      onChange={(e) => setYoutubeForm({ ...youtubeForm, artistName: e.target.value })}
                      placeholder="Your channel / artist name" />
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube Channel URL *</Label>
                    <Input value={youtubeForm.youtubeUrl}
                      onChange={(e) => setYoutubeForm({ ...youtubeForm, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/@yourchannel" />
                  </div>
                  <div className="space-y-2">
                    <Label>Topic Channel URL *</Label>
                    <Input value={youtubeForm.topicChannelUrl}
                      onChange={(e) => setYoutubeForm({ ...youtubeForm, topicChannelUrl: e.target.value })}
                      placeholder="https://youtube.com/channel/UC...-Topic" />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Distributor *</Label>
                    <Select
                      value={youtubeForm.distributorName}
                      onValueChange={(v) => setYoutubeForm({ ...youtubeForm, distributorName: v })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select your distributor" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {DISTRIBUTORS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
<div className="space-y-2">
                    <Label>Mobile Money / Payment Phone *</Label>
                    <Input type="tel" value={youtubeForm.phone}
                      onChange={(e) => setYoutubeForm({ ...youtubeForm, phone: e.target.value })}
                      placeholder="e.g. 0971234567"
                      className="h-10"
                    />
                  </div>
                  <Button
                    className={`w-full font-bold py-3 sm:py-4 text-sm sm:text-base ${PLATFORM_CONFIG.youtube.accent}`}
                    disabled={loadingPlatform !== null || verifiedPlatforms.has("youtube")}
                  >
                    {loadingPlatform === "youtube" ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing payment…</>
                    ) : "Pay K260 & Submit via Lenco"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Verify;
