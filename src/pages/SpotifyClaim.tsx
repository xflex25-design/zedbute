import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Music2,
  ShieldCheck,
} from "lucide-react";

const CLAIM_FEE = 40;

const DISTRIBUTORS = [
  "DistroKid",
  "TuneCore",
  "CD Baby",
  "ONErpm",
  "Boomplay Distribution",
  "Other",
];

type Stage = "loading" | "eligibility" | "no-song" | "form" | "pay" | "done";

interface ExistingClaim {
  id: string;
  claim_status: string;
  payment_status: string;
  spotify_link: string | null;
  distributor: string | null;
  admin_notes: string | null;
}

const SpotifyClaim = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("loading");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [existing, setExisting] = useState<ExistingClaim | null>(null);
  const [eligibility, setEligibility] = useState<null | "yes" | "no">(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [spotifyLink, setSpotifyLink] = useState("");
  const [distributor, setDistributor] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialize() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, full_name, artist_name")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(profileData);

      const { data: claim } = await (supabase as any)
        .from("spotify_claims")
        .select("id, claim_status, payment_status, spotify_link, distributor, admin_notes")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (claim) {
        setExisting(claim as ExistingClaim);
        // If the fee is already paid/pending, show the final status.
        // Otherwise resume the payment flow.
        if (claim.payment_status === "paid" || claim.payment_status === "pending") {
          setStage("done");
        } else {
          setStage("pay");
        }
        return;
      }

      setStage("eligibility");
    } catch (err) {
      console.error(err);
      toast({
        title: "Something went wrong",
        description: "Could not load your claim. Please refresh.",
        variant: "destructive",
      });
    }
  }

  function chooseEligibility(answer: "yes" | "no") {
    setEligibility(answer);
    if (answer === "no") {
      setStage("no-song");
      return;
    }
    // Pre-fill the form with profile data for convenience.
    setName(profile?.artist_name || profile?.full_name || "");
    setEmail(user?.email || profile?.email || "");
    setStage("form");
  }

  function goToPayment(claimId: string) {
    navigate(
      `/payment?type=spotify-claim&claimId=${claimId}&amount=${CLAIM_FEE}`
    );
  }

  async function submitForm() {
    if (!name.trim() || !email.trim() || !distributor) {
      toast({
        title: "Missing information",
        description: "Please fill in your name, email and distributor.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    setSubmitting(true);
    try {
      // Save the form first (unpaid), then send the user to pay — just like
      // the upload-release flow. Payment success marks it paid + sends email.
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("spotify_claims")
        .insert({
          user_id: user.id,
          name: name.trim(),
          email: email.trim(),
          spotify_link: spotifyLink.trim() || null,
          distributor,
          notes: notes.trim() || null,
          payment_status: "unpaid",
          payment_transaction_id: null,
          payment_amount: CLAIM_FEE,
          claim_status: "New",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Form saved",
        description: "Redirecting you to complete payment...",
      });

      goToPayment(inserted.id);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Submission failed",
        description: err?.message ?? "Could not save your claim. Contact support.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "loading") {
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
        <div className="max-w-xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <Music2 className="h-7 w-7 text-green-500" />
              Claim Your Spotify Artist Profile
            </h1>
            <p className="text-muted-foreground">
              We never log into Spotify for you and never ask for your Spotify
              password. Fill in your details, pay the small fee, and we'll email
              you the exact steps to claim it yourself.
            </p>
          </div>

          {/* ELIGIBILITY GATE */}
          {stage === "eligibility" && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Do you already have a song live on Spotify?</CardTitle>
                <CardDescription>
                  You can only claim a Spotify artist profile once your music is
                  distributed and live on Spotify.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => chooseEligibility("yes")}
                >
                  Yes, I have a song on Spotify
                </Button>
                <Button
                  className="w-full"
                  size="lg"
                  variant="outline"
                  onClick={() => chooseEligibility("no")}
                >
                  No, not yet
                </Button>
              </CardContent>
            </Card>
          )}

          {/* NOT ELIGIBLE */}
          {stage === "no-song" && (
            <Card className="shadow-card border-amber-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                  You need a song live on Spotify first
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You need a song live on Spotify before you can claim your
                  profile. Please distribute your music first (e.g., via
                  DistroKid, TuneCore, CD Baby, or Boomplay's distribution
                  service), then come back.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                  </Button>
                  <Button onClick={() => setStage("eligibility")}>
                    Re-check eligibility
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MANUAL FORM */}
          {stage === "form" && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Complete your claim details</CardTitle>
                <CardDescription>
                  Fill this in, then you'll pay the K{CLAIM_FEE} fee and we'll
                  email your claim instructions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Spotify Artist Link (if known)</Label>
                  <Input
                    value={spotifyLink}
                    onChange={(e) => setSpotifyLink(e.target.value)}
                    placeholder="https://open.spotify.com/artist/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Distributor Used *</Label>
                  <Select value={distributor} onValueChange={setDistributor}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select your distributor" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {DISTRIBUTORS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Any notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you'd like our team to know"
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                  onClick={submitForm}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit & Continue to Payment"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* PAY (resume / pending payment) */}
          {stage === "pay" && existing && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Complete your claim payment
                </CardTitle>
                <CardDescription>
                  Your details are saved. Pay the K{CLAIM_FEE} fee to receive your
                  Spotify claim instructions by email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                 <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                   <p className="text-3xl font-bold">K{CLAIM_FEE} <span className="text-base text-muted-foreground">(${(CLAIM_FEE / 25).toFixed(2)} USD)</span></p>
                   <p className="text-xs text-muted-foreground mt-1">
                     Secure checkout via Pesapal (Mobile Money)
                   </p>
                 </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => goToPayment(existing.id)}
                  >
                    Pay K{CLAIM_FEE}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DONE / STATUS */}
          {stage === "done" && (
            <Card className="shadow-card border-green-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Claim request received
                </CardTitle>
                <CardDescription>
                  Here's where your Spotify claim stands.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-600 hover:bg-green-600 text-white">
                    Payment: {existing?.payment_status ?? "paid"}
                  </Badge>
                  <Badge className="bg-primary hover:bg-primary text-primary-foreground">
                    Status: {existing?.claim_status ?? "New"}
                  </Badge>
                </div>

                {existing?.claim_status === "Instructions Sent" && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      We've emailed you the steps to claim your profile on
                      Spotify's own site. Complete the verification (code or
                      video) directly with Spotify.
                    </span>
                  </div>
                )}

                {existing?.spotify_link && (
                  <a
                    href={existing.spotify_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {existing.spotify_link}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {existing?.admin_notes && (
                  <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm">
                    <p className="font-medium mb-1">Note from our team:</p>
                    <p className="text-muted-foreground">{existing.admin_notes}</p>
                  </div>
                )}

                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpotifyClaim;
