import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const PAYMENT_SESSION_KEY = "spotifyClaimPayment";

type Stage = "loading" | "eligibility" | "no-song" | "payment" | "form" | "done";

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
  const [searchParams] = useSearchParams();

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
        setStage("done");
        return;
      }

      // Reached this page after a successful payment (eligibility already passed).
      if (searchParams.get("paid") === "1") {
        setName(profile?.artist_name || profile?.full_name || "");
        setEmail(user?.email || profile?.email || "");
        setStage("form");
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
    setStage("payment");
  }

  function goToPayment() {
    // The Payment page records the transaction and returns here with ?paid=1.
    navigate(
      `/payment?type=spotify-claim&amount=${CLAIM_FEE}&returnUrl=${encodeURIComponent(
        "/spotify-claim?paid=1"
      )}`
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

    const raw = sessionStorage.getItem(PAYMENT_SESSION_KEY);
    const payment = raw ? JSON.parse(raw) : null;
    const paymentStatus: "paid" | "pending" =
      payment?.status === "verified" ? "paid" : "pending";
    const transactionId: string | null = payment?.transactionId ?? null;

    setSubmitting(true);
    try {
      // 1. Store the submission (payment info + manual form).
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("spotify_claims")
        .insert({
          user_id: user.id,
          name: name.trim(),
          email: email.trim(),
          spotify_link: spotifyLink.trim() || null,
          distributor,
          notes: notes.trim() || null,
          payment_status: paymentStatus,
          payment_transaction_id: transactionId,
          payment_amount: CLAIM_FEE,
          claim_status: "New",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 2. Send the artist the Spotify claim instructions via Resend.
      const { error: fnError } = await supabase.functions.invoke(
        "send-spotify-claim-instructions",
        {
          body: {
            to_email: email.trim(),
            to_name: name.trim(),
            spotify_link: spotifyLink.trim() || null,
          },
        }
      );

      if (fnError) {
        // Payment + form saved, but the email failed. Leave status as "New"
        // so an admin can resend later.
        console.error("Resend instructions email failed:", fnError);
        toast({
          title: "Saved, but email failed",
          description:
            "Your claim was saved. Our team will send your instructions shortly.",
          variant: "destructive",
        });
      } else {
        if (inserted?.id) {
          await (supabase as any)
            .from("spotify_claims")
            .update({ claim_status: "Instructions Sent" })
            .eq("id", inserted.id);
        }
        toast({
          title: "You're all set!",
          description: "Check your inbox for the Spotify claim steps.",
        });
      }

      sessionStorage.removeItem(PAYMENT_SESSION_KEY);
      setExisting({
        id: inserted?.id,
        claim_status: "Instructions Sent",
        payment_status: paymentStatus,
        spotify_link: spotifyLink.trim() || null,
        distributor,
        admin_notes: null,
      });
      setStage("done");
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
              password. We simply gate access, collect your fee, and send you
              the exact steps to claim it yourself.
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

          {/* PAYMENT */}
          {stage === "payment" && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Spotify Claim — Processing Fee</CardTitle>
                <CardDescription>
                  Pay a small one-time fee to start your claim. After payment
                  you'll fill in a short form and get your instructions by email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold">K{CLAIM_FEE}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Secure checkout via Lenco (Mobile Money or Card)
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => setStage("eligibility")}>
                    Back
                  </Button>
                  <Button className="flex-1" size="lg" onClick={goToPayment}>
                    Pay K{CLAIM_FEE} &amp; Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MANUAL FORM (always shown after payment) */}
          {stage === "form" && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Complete your claim details</CardTitle>
                <CardDescription>
                  Payment received. Fill this in so we can send you the right
                  instructions.
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
                    "Submit &amp; Get Instructions"
                  )}
                </Button>
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
