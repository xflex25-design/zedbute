import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Youtube } from "lucide-react";

type Platform = "youtube";

const PLATFORM_CONFIG: Record<Platform, { label: string; amount: number; accent: string }> = {
  youtube: { label: "YouTube OAC", amount: 260, accent: "bg-red-600 hover:bg-red-700 text-white" },
};

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
      setYoutubeForm((f) => ({ ...f, phone: ph }));

      const { data: existing } = await supabase
        .from("artist_verifications")
        .select("platform")
        .eq("user_id", session.user.id);
      if (existing) {
        const set = new Set<Platform>();
        existing.forEach((r: any) => {
          if (r.platform === "youtube") {
            set.add(r.platform);
          }
        });
        setVerifiedPlatforms(set);
      }
    };
    init();
  }, [navigate]);

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
      youtube_url: payload.youtube_url ?? null,
      topic_channel_url: payload.topic_channel_url ?? null,
      distributor_name: payload.distributor_name ?? null,
      payment_status: "paid",
      payment_transaction_id: transactionId,
      payment_phone_number: payload.phone,
      status: "pending",
    } as any);
    if (error) throw error;
  };

  const saveVerificationDraft = async (platform: Platform, payload: any) => {
    const { data, error } = await (supabase as any)
      .from("artist_verifications")
      .insert({
        user_id: user.id,
        platform,
        artist_name: payload.artist_name,
        youtube_url: payload.youtube_url ?? null,
        topic_channel_url: payload.topic_channel_url ?? null,
        distributor_name: payload.distributor_name ?? null,
        payment_status: "unpaid",
        payment_transaction_id: null,
        payment_phone_number: payload.phone,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  };

  const goToPayment = async () => {
    const err = validateYouTube(youtubeForm);
    if (err) {
      toast({ title: "Missing info", description: err, variant: "destructive" });
      return;
    }

    setLoadingPlatform("youtube");
    try {
      const verificationId = await saveVerificationDraft("youtube", {
        artist_name: youtubeForm.artistName,
        youtube_url: youtubeForm.youtubeUrl,
        topic_channel_url: youtubeForm.topicChannelUrl,
        distributor_name: youtubeForm.distributorName,
        phone: youtubeForm.phone,
      });

      navigate(`/payment?type=verification&amount=${PLATFORM_CONFIG.youtube.amount}&verificationId=${verificationId}`);
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
              Choose your platform and pay securely via Pesapal (Mobile Money) to start the verification process.
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <Youtube className="h-5 w-5" /> YouTube Official Artist Channel
                </CardTitle>
                 <Badge className="bg-red-600 hover:bg-red-600 text-white">Processing Fee: K260 Kwacha (~$10.40 USD)</Badge>
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
                onClick={goToPayment}
              >
                {loadingPlatform === "youtube" ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Processing…</>
                ) : (
                  <>Pay K{PLATFORM_CONFIG.youtube.amount} (${(PLATFORM_CONFIG.youtube.amount / 25).toFixed(2)} USD) — Pesapal or Card</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Verify;
