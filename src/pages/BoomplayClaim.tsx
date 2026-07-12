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
  ExternalLink,
  Loader2,
  Music2,
  ShieldCheck,
} from "lucide-react";

const DISTRIBUTORS = [
  "DistroKid",
  "TuneCore",
  "CD Baby",
  "ONErpm",
  "Boomplay Distribution",
  "Other",
];

type Stage = "loading" | "eligibility" | "no-song" | "form" | "done";

interface ExistingClaim {
  id: string;
  claim_status: string;
  boomplay_link: string | null;
  distributor: string | null;
  admin_notes: string | null;
}

const BoomplayClaim = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("loading");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [existing, setExisting] = useState<ExistingClaim | null>(null);
  const [eligibility, setEligibility] = useState<null | "yes" | "no">(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [boomplayLink, setBoomplayLink] = useState("");
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
        .from("boomplay_claims")
        .select("id, claim_status, boomplay_link, distributor, admin_notes")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (claim) {
        setExisting(claim as ExistingClaim);
        setStage("done");
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
    setName(profile?.artist_name || profile?.full_name || "");
    setEmail(user?.email || profile?.email || "");
    setStage("form");
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
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("boomplay_claims")
        .insert({
          user_id: user.id,
          name: name.trim(),
          email: email.trim(),
          boomplay_link: boomplayLink.trim() || null,
          distributor,
          notes: notes.trim() || null,
          payment_status: "unpaid",
          payment_transaction_id: null,
          payment_amount: null,
          claim_status: "New",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const { error: fnError } = await supabase.functions.invoke(
        "send-boomplay-claim-instructions",
        {
          body: {
            to_email: email.trim(),
            to_name: name.trim(),
            boomplay_link: boomplayLink.trim() || null,
          },
        }
      );

      if (fnError) {
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
            .from("boomplay_claims")
            .update({ claim_status: "Instructions Sent" })
            .eq("id", inserted.id);
        }
        toast({
          title: "You're all set!",
          description: "Check your inbox for the Boomplay claim steps.",
        });
      }

      setExisting({
        id: inserted?.id,
        claim_status: "Instructions Sent",
        boomplay_link: boomplayLink.trim() || null,
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
              <Music2 className="h-7 w-7 text-[#F7931E]" />
              Claim Your Boomplay Artist Profile
            </h1>
            <p className="text-muted-foreground">
              We never log into Boomplay for you and never ask for your Boomplay
              password. Tell us a bit about your profile and we'll send you the
              exact steps to claim it yourself.
            </p>
          </div>

          {/* ELIGIBILITY GATE */}
          {stage === "eligibility" && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Do you already have a song live on Boomplay?</CardTitle>
                <CardDescription>
                  You can only claim a Boomplay artist profile once your music is
                  distributed and live on Boomplay.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => chooseEligibility("yes")}
                >
                  Yes, I have a song on Boomplay
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
                  You need a song live on Boomplay first
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You need a song live on Boomplay before you can claim your
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
                  Fill this in so we can send you the right instructions to
                  claim your profile on Boomplay.
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
                  <Label>Boomplay Artist Link (if known)</Label>
                  <Input
                    value={boomplayLink}
                    onChange={(e) => setBoomplayLink(e.target.value)}
                    placeholder="https://www.boomplay.com/artist/..."
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
                  Here's where your Boomplay claim stands.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-primary hover:bg-primary text-primary-foreground">
                    Status: {existing?.claim_status ?? "New"}
                  </Badge>
                </div>

                {existing?.claim_status === "Instructions Sent" && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      We've emailed you the steps to claim your profile on
                      Boomplay's own site. Complete the verification directly
                      with Boomplay.
                    </span>
                  </div>
                )}

                {existing?.boomplay_link && (
                  <a
                    href={existing.boomplay_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {existing.boomplay_link}
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

export default BoomplayClaim;
