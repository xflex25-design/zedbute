import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

const verificationSchema = z.object({
  artistName: z.string().trim().min(1, "Artist name is required").max(100),
  bio: z.string().trim().max(1000).optional(),
  youtubeUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  instagramUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  tiktokUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  spotifyUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  soundcloudUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  twitterUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  facebookUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  websiteUrl: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
});

const VERIFICATION_DEPOSIT = 50; // $50 deposit

const Verify = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasVerification, setHasVerification] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    artistName: "",
    bio: "",
    youtubeUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
    spotifyUrl: "",
    soundcloudUrl: "",
    twitterUrl: "",
    facebookUrl: "",
    websiteUrl: "",
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Check if already has verification
      const { data } = await supabase
        .from("artist_verifications")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      if (data) {
        setHasVerification(true);
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      verificationSchema.parse(formData);

      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to submit verification",
          variant: "destructive",
        });
        return;
      }

      // Insert verification request
      const { error } = await supabase
        .from("artist_verifications")
        .insert({
          user_id: user.id,
          artist_name: formData.artistName,
          bio: formData.bio || null,
          youtube_url: formData.youtubeUrl || null,
          instagram_url: formData.instagramUrl || null,
          tiktok_url: formData.tiktokUrl || null,
          spotify_url: formData.spotifyUrl || null,
          soundcloud_url: formData.soundcloudUrl || null,
          twitter_url: formData.twitterUrl || null,
          facebook_url: formData.facebookUrl || null,
          website_url: formData.websiteUrl || null,
          deposit_amount: VERIFICATION_DEPOSIT,
          payment_status: "unpaid",
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Application submitted!",
        description: `Please complete the $${VERIFICATION_DEPOSIT} verification deposit to proceed.`,
      });

      // In a real app, redirect to payment page
      // For now, just navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to submit verification. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (hasVerification) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Card className="max-w-2xl mx-auto shadow-card text-center">
            <CardContent className="pt-12 pb-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Already Applied</h2>
              <p className="text-muted-foreground mb-6">
                You've already submitted a verification application. Check your dashboard for status updates.
              </p>
              <Button variant="hero" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Artist Verification</h1>
            <p className="text-muted-foreground">
              Get verified to unlock premium distribution features and credibility
            </p>
          </div>

          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle>Verification Fee</CardTitle>
              <CardDescription>
                A one-time deposit of ${VERIFICATION_DEPOSIT} is required to process your verification
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Artist Information</CardTitle>
              <CardDescription>
                Provide your social media links and artist details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="artistName">Artist Name *</Label>
                  <Input
                    id="artistName"
                    value={formData.artistName}
                    onChange={(e) => handleChange("artistName", e.target.value)}
                    placeholder="Your artist/band name"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleChange("bio", e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube</Label>
                    <Input
                      id="youtube"
                      type="url"
                      value={formData.youtubeUrl}
                      onChange={(e) => handleChange("youtubeUrl", e.target.value)}
                      placeholder="https://youtube.com/@channel"
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      type="url"
                      value={formData.instagramUrl}
                      onChange={(e) => handleChange("instagramUrl", e.target.value)}
                      placeholder="https://instagram.com/username"
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok</Label>
                    <Input
                      id="tiktok"
                      type="url"
                      value={formData.tiktokUrl}
                      onChange={(e) => handleChange("tiktokUrl", e.target.value)}
                      placeholder="https://tiktok.com/@username"
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="spotify">Spotify</Label>
                    <Input
                      id="spotify"
                      type="url"
                      value={formData.spotifyUrl}
                      onChange={(e) => handleChange("spotifyUrl", e.target.value)}
                      placeholder="https://open.spotify.com/artist/..."
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="soundcloud">SoundCloud</Label>
                    <Input
                      id="soundcloud"
                      type="url"
                      value={formData.soundcloudUrl}
                      onChange={(e) => handleChange("soundcloudUrl", e.target.value)}
                      placeholder="https://soundcloud.com/username"
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitter">X (Twitter)</Label>
                    <Input
                      id="twitter"
                      type="url"
                      value={formData.twitterUrl}
                      onChange={(e) => handleChange("twitterUrl", e.target.value)}
                      placeholder="https://x.com/username"
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      type="url"
                      value={formData.facebookUrl}
                      onChange={(e) => handleChange("facebookUrl", e.target.value)}
                      placeholder="https://facebook.com/page"
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) => handleChange("websiteUrl", e.target.value)}
                      placeholder="https://yourwebsite.com"
                      maxLength={500}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading ? "Submitting..." : `Submit & Pay $${VERIFICATION_DEPOSIT}`}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    By submitting, you agree to pay the verification deposit
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Verify;
