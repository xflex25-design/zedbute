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
import { FormProgress } from "@/components/FormProgress";
import { z } from "zod";

const verificationSchema = z.object({
  artistName: z.string().trim().min(1, "Artist name is required").max(100),
  bio: z.string().trim().min(10, "Bio must be at least 10 characters").max(1000),
  boomplayUrl: z.string().url("Invalid Boomplay URL").min(1, "Boomplay URL is required").max(500),
  spotifyUrl: z.string().url("Invalid Spotify URL").min(1, "Spotify URL is required").max(500),
  youtubeUrl: z.string().url("Invalid YouTube URL").max(500).optional().or(z.literal("")),
});

const VERIFICATION_DEPOSIT = 30; // K30 deposit

const Verify = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasVerification, setHasVerification] = useState(false);
  const [hasValidPayment, setHasValidPayment] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState(() => {
    // Restore form data from sessionStorage if available
    const saved = sessionStorage.getItem("verifyFormData");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          artistName: "",
          bio: "",
          boomplayUrl: "",
          spotifyUrl: "",
          youtubeUrl: "",
        };
      }
    }
    return {
      artistName: "",
      bio: "",
      boomplayUrl: "",
      spotifyUrl: "",
      youtubeUrl: "",
    };
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
        setHasValidPayment(true);
        return;
      }

      // Server-side check: must have a verified verification payment in release_payments
      const { data: payments } = await supabase
        .from("release_payments")
        .select("id, status, transaction_id")
        .eq("user_id", session.user.id)
        .eq("status", "verified")
        .ilike("transaction_id", "verification-%");

      setHasValidPayment((payments?.length ?? 0) > 0);
      // Clean up any stale session flag
      sessionStorage.removeItem("pendingVerificationPayment");
    };
    checkUser();
  }, [navigate, toast]);

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

      // Check if payment is required
      if (!hasValidPayment) {
        // Save form data to sessionStorage before redirecting to payment
        sessionStorage.setItem("verifyFormData", JSON.stringify(formData));
        toast({
          title: "Payment Required",
          description: "Please complete payment to submit your verification.",
        });
        navigate("/payment?type=verification");
        return;
      }

      // Insert verification request
      const { error } = await supabase
        .from("artist_verifications")
        .insert({
          user_id: user.id,
          artist_name: formData.artistName,
          bio: formData.bio,
          youtube_url: formData.youtubeUrl || null,
          spotify_url: formData.spotifyUrl,
          website_url: formData.boomplayUrl,
          deposit_amount: VERIFICATION_DEPOSIT,
          payment_status: "paid",
          status: "pending",
        });

      if (error) throw error;

      // Clear saved form data
      sessionStorage.removeItem("verifyFormData");

      toast({
        title: "Application submitted!",
        description: "Your verification will be processed within 2 weeks.",
      });

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

  // Loading state
  if (!user || hasValidPayment === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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

          {hasValidPayment && (
            <Card className="shadow-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Payment Confirmed
                </CardTitle>
                <CardDescription>
                  Your K{VERIFICATION_DEPOSIT} verification fee has been received. Processing takes approximately 2 weeks.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {!hasValidPayment && (
            <Card className="shadow-card mb-6 border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Payment Required
                </CardTitle>
                <CardDescription className="text-amber-600">
                  Fill out the form below. You'll be redirected to payment (K{VERIFICATION_DEPOSIT}) when you submit.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Artist Verification</CardTitle>
              <CardDescription>
                Get verified on Boomplay and Spotify. We'll process your verification within 2 weeks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormProgress
                steps={[
                  { label: "Artist Name", completed: formData.artistName.trim().length > 0 },
                  { label: "Bio", completed: formData.bio.trim().length >= 10 },
                  { label: "Boomplay URL", completed: formData.boomplayUrl.includes("boomplay.com") },
                  { label: "Spotify URL", completed: formData.spotifyUrl.includes("spotify.com") },
                ]}
              />
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
                  <Label htmlFor="bio">Bio *</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleChange("bio", e.target.value)}
                    placeholder="Tell us about your music and journey (minimum 10 characters)"
                    rows={4}
                    required
                    maxLength={1000}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Platform Links</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="boomplay">Boomplay URL *</Label>
                    <Input
                      id="boomplay"
                      type="url"
                      value={formData.boomplayUrl}
                      onChange={(e) => handleChange("boomplayUrl", e.target.value)}
                      placeholder="https://www.boomplay.com/artists/..."
                      required
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="spotify">Spotify URL *</Label>
                    <Input
                      id="spotify"
                      type="url"
                      value={formData.spotifyUrl}
                      onChange={(e) => handleChange("spotifyUrl", e.target.value)}
                      placeholder="https://open.spotify.com/artist/..."
                      required
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube (Optional)</Label>
                    <Input
                      id="youtube"
                      type="url"
                      value={formData.youtubeUrl}
                      onChange={(e) => handleChange("youtubeUrl", e.target.value)}
                      placeholder="https://youtube.com/@channel"
                      maxLength={500}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading ? "Submitting..." : hasValidPayment ? "Submit Verification Request" : "Continue to Payment"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {hasValidPayment 
                      ? "Your application will be processed within 2 weeks"
                      : "You'll be redirected to complete payment after form validation"
                    }
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
