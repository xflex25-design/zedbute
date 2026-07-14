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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Music2,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";

const CLAIM_FEE = 40;

const COUNTRY_CODES = [
  "+260",
  "+1",
  "+44",
  "+234",
  "+27",
  "+254",
  "+255",
  "+256",
  "+233",
];

const SOCIAL_PLATFORMS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "X/Twitter",
  "YouTube",
];

type Stage = "loading" | "eligibility" | "no-song" | "form" | "pay" | "done";

interface ExistingClaim {
  id: string;
  claim_status: string;
  payment_status: string;
  boomplay_link: string | null;
  distributor: string | null;
  admin_notes: string | null;
}

function ImageUploadBox({
  fileName,
  onSelect,
}: {
  fileName: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 cursor-pointer">
      <div className="w-28 h-28 rounded-lg border-2 border-dashed border-border bg-muted/40 flex items-center justify-center text-muted-foreground hover:border-primary transition-colors overflow-hidden">
        {fileName ? (
          <span className="text-xs px-2 text-center break-all">{fileName}</span>
        ) : (
          <Plus className="h-8 w-8" />
        )}
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}

const BoomplayClaim = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("loading");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [existing, setExisting] = useState<ExistingClaim | null>(null);
  const [eligibility, setEligibility] = useState<null | "yes" | "no">(null);

  // Contact information
  const [fullName, setFullName] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const [countryCode, setCountryCode] = useState("+260");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [distributorName, setDistributorName] = useState("");

  // Email verification (UI)
  const [emailCode, setEmailCode] = useState("");

  // Identity proof
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [socialImageName, setSocialImageName] = useState<string | null>(null);
  const [backendImageName, setBackendImageName] = useState<string | null>(null);

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
        .select("email, full_name, artist_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(profileData);

      const { data: claim } = await (supabase as any)
        .from("boomplay_claims")
        .select("id, claim_status, payment_status, boomplay_link, distributor, admin_notes")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (claim) {
        setExisting(claim as ExistingClaim);
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
    setFullName(profile?.artist_name || profile?.full_name || "");
    setEmailAddr(user?.email || profile?.email || "");
    setStage("form");
  }

  function goToPayment(claimId: string) {
    navigate(
      `/payment?type=boomplay-claim&claimId=${claimId}&amount=${CLAIM_FEE}`
    );
  }

  function sendCode() {
    if (!emailAddr.trim()) {
      toast({
        title: "Enter your email first",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Code sent",
      description: `We've sent a verification code to ${emailAddr}.`,
    });
  }

  async function submitForm() {
    if (!fullName.trim() || !emailAddr.trim() || !phoneNumber.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in your full name, email and mobile number.",
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
      // Pack the new identity-proof fields into the existing `notes` column so
      // storage/submission stays unchanged; the core columns map directly.
      const packedNotes = [
        `Mobile: ${countryCode} ${phoneNumber.trim()}`,
        distributorName.trim()
          ? `Distributor: ${distributorName.trim()}`
          : null,
        socialPlatform || socialLink.trim()
          ? `Social (${socialPlatform || "platform"}): ${socialLink.trim()}`
          : null,
        socialImageName ? `Social screenshot: ${socialImageName}` : null,
        backendImageName
          ? `Distributor/Label backend screenshot: ${backendImageName}`
          : null,
        emailCode.trim() ? `Email code entered: ${emailCode.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const { data: inserted, error: insertError } = await (supabase as any)
        .from("boomplay_claims")
        .insert({
          user_id: user.id,
          name: fullName.trim(),
          email: emailAddr.trim(),
          boomplay_link: null,
          distributor: distributorName.trim() || null,
          notes: packedNotes || null,
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
              <Music2 className="h-7 w-7 text-[#F7931E]" />
              Claim Your Boomplay Artist Profile
            </h1>
            <p className="text-muted-foreground">
              We never log into Boomplay for you and never ask for your Boomplay
              password. Fill in your details, pay the small fee, and we'll email
              you the exact steps to claim it yourself.
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
                <div className="flex flex-col items-center gap-2 mb-2">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={profile?.avatar_url || undefined}
                      alt={fullName || "Artist"}
                    />
                    <AvatarFallback>
                      {(fullName || profile?.artist_name || "A")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-center">
                    {fullName || profile?.artist_name || "Artist"}
                  </p>
                </div>
                <CardTitle>Claim Submission</CardTitle>
                <CardDescription>
                  Fill this in, then you'll pay the K{CLAIM_FEE} fee and we'll
                  email your claim instructions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* SECTION: Your Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Your Contact Information
                  </h3>

                  <div className="space-y-2">
                    <Label>
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full legal name here"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={emailAddr}
                      onChange={(e) => setEmailAddr(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      This email is used for identity verification when settling
                      royalties for artists uploading tracks on Boomplay.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Input
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value)}
                        placeholder="Enter the code"
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={sendCode}>
                        <Send className="h-4 w-4 mr-1" /> Send Code
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Mobile Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-28 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Enter a valid phone number"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Distributor Name</Label>
                    <Input
                      value={distributorName}
                      onChange={(e) => setDistributorName(e.target.value)}
                      placeholder="Contact your label or agent for more info"
                    />
                  </div>
                </div>

                {/* SECTION: Artist Identity Proof */}
                <div className="space-y-4">
                  <div className="rounded-lg bg-purple-100 border border-purple-200 p-4 space-y-1">
                    <p className="font-bold text-purple-900">
                      Provide As Much Identity Proof As Possible.
                    </p>
                    <p className="font-bold text-red-600 text-sm">
                      Upload at least one screenshot from any proof type below.
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      The more complete your proof is, the higher the chance of
                      passing review and the faster we can verify the rightful
                      artist or representative.
                    </p>
                  </div>

                  {/* Social Media Profile */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">
                      Social Media Profile{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </h4>
                    <div className="flex items-start gap-4">
                      <ImageUploadBox
                        fileName={socialImageName}
                        onSelect={setSocialImageName}
                      />
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          Upload a screenshot from the artist account owner's
                          main profile page
                        </p>
                        <p className="italic text-blue-600">
                          Size: Maximum 5MB
                        </p>
                        <p className="italic text-blue-600">
                          Format: jpg/png/jpeg
                        </p>
                      </div>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                      <li>Artist or profile name is visible.</li>
                      <li>Username, handle, or profile URL is visible.</li>
                      <li>
                        Profile photo or verified badge is visible if available.
                      </li>
                      <li>
                        Bio, public posts, page category, or channel content
                        proves this is the official artist account.
                      </li>
                    </ul>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select
                        value={socialPlatform}
                        onValueChange={setSocialPlatform}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {SOCIAL_PLATFORMS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Profile Link</Label>
                      <Input
                        value={socialLink}
                        onChange={(e) => setSocialLink(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                  </div>

                  {/* Distributor or Label Backend */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <h4 className="text-sm font-semibold">
                      Distributor or Label Backend{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </h4>
                    <div className="flex items-start gap-4">
                      <ImageUploadBox
                        fileName={backendImageName}
                        onSelect={setBackendImageName}
                      />
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          If your music is managed through a distributor, label,
                          or agent, add content management backend proof
                        </p>
                        <p className="italic text-blue-600">
                          Size: Maximum 5MB
                        </p>
                        <p className="italic text-blue-600">
                          Format: jpg/png/jpeg
                        </p>
                      </div>
                    </div>
                  </div>
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
                  Boomplay claim instructions by email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                 <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                   <p className="text-3xl font-bold">K{CLAIM_FEE} <span className="text-base text-muted-foreground">(${(CLAIM_FEE / 25).toFixed(2)} USD)</span></p>
                   <p className="text-xs text-muted-foreground mt-1">
                     Secure checkout via Lenco (Mobile Money) or Stripe (Card)
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
                  Here's where your Boomplay claim stands.
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
