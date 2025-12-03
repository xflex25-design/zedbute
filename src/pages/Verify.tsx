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

  const [formData, setFormData] = useState({
    artistName: "",
    bio: "",
    boomplayUrl: "",
    spotifyUrl: "",
    youtubeUrl: "",
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

      // Check for valid payment for verification
      const { data: payments } = await supabase
        .from("release_payments")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "verified")
        .eq("amount", VERIFICATION_DEPOSIT);
      
      if (!payments || payments.length === 0) {
        // Check for pending payment
        const { data: pendingPayments } = await supabase
          .from("release_payments")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("status", "pending")
          .eq("amount", VERIFICATION_DEPOSIT);
        
        if (pendingPayments && pendingPayments.length > 0) {
          toast({
            title: "Payment Pending",
            description: "Your verification payment is being verified. Please wait for confirmation.",
          });
          setHasValidPayment(false);
        } else {
          // No payment found, redirect to payment page
          navigate("/payment?type=verification");
        }
      } else {
        setHasValidPayment(true);
      }
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

  // Payment pending state
  if (hasValidPayment === false) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Card className="max-w-2xl mx-auto shadow-card text-center">
            <CardContent className="pt-12 pb-8">
              <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Payment Pending</h2>
              <p className="text-muted-foreground mb-6">
                Your verification payment is being verified. You'll be notified once confirmed and can then submit your verification request.
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
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Payment Confirmed
              </CardTitle>
              <CardDescription>
                Your K{VERIFICATION_DEPOSIT} verification fee has been received. Processing takes approximately 2 weeks.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Artist Verification</CardTitle>
              <CardDescription>
                Get verified on Boomplay and Spotify. We'll process your verification within 2 weeks.
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
                    {loading ? "Submitting..." : "Submit Verification Request"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Your application will be processed within 2 weeks
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
