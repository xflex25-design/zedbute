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
import { ArrowLeft, CheckCircle2, Loader2, Music, Phone, Zap } from "lucide-react";

type Platform = "spotify" | "boomplay";

const LENCO_PUBLIC_KEY = "pub-6f90c9d7234ba5738a66ac8036942f6200ab2da1851e0e0c";
const PAYMENT_AMOUNT = 50;

const META: Record<Platform, { title: string; subtitle: string; color: string; emoji: string; defaultPhone: string }> = {
  spotify: {
    title: "Spotify for Artists Verification",
    subtitle: "We'll submit your claim to Spotify for Artists on your behalf.",
    color: "border-green-500",
    emoji: "🟢",
    defaultPhone: "+260",
  },
  boomplay: {
    title: "Boomplay for Artists Verification",
    subtitle: "Claim your official Boomplay artist profile.",
    color: "border-blue-500",
    emoji: "🔵",
    defaultPhone: "+260",
  },
};

const VerifyClaim = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");

  // two-step flow: "form" | "payment"
  const [step, setStep] = useState<"form" | "payment">("form");

  const [form, setForm] = useState({
    artistName: "",
    spotifyUrl: "",
    legalName: "",
    email: "",
    phone: "+260",
    distributor: "ZedBute",
    socialUrl: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setForm((f) => ({ ...f, email: session.user.email || "" }));

      // pre-fill payment phone from profile if available
      supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profileData }) => {
          setProfile(profileData);
          if (profileData?.phone_number) {
            setPaymentPhone(profileData.phone_number);
          }
        });
    });
  }, [navigate]);

  const selectPlatform = (p: Platform) => {
    setPlatform(p);
    setForm((f) => ({ ...f, phone: META[p].defaultPhone }));
    setSubmitted(false);
    setStep("form");
  };

  // Step 1: validate form, advance to payment
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !platform) return;

    if (!form.artistName || !form.legalName || !form.email || !form.phone || !form.socialUrl) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (platform === "spotify" && !form.spotifyUrl) {
      toast({ title: "Spotify URL required", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Screenshot required", description: "Please upload a social media screenshot.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }

    setStep("payment");
  };

  // Step 2: upload files + insert record after payment succeeds
  const submitVerification = async (transactionId: string, paymentStatus: "verified" | "pending") => {
    const ext = file!.name.split(".").pop();
    const path = `${user.id}/${platform}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("verification-screenshots")
      .upload(path, file!, { upsert: false });
    if (upErr) throw upErr;

    const { error: insErr } = await supabase.from("artist_verifications").insert({
      user_id: user.id,
      platform,
      artist_name: form.artistName,
      legal_name: form.legalName,
      platform_email: form.email,
      payment_phone_number: form.phone,
      distributor_name: form.distributor,
      spotify_url: platform === "spotify" ? form.spotifyUrl : null,
      instagram_url: form.socialUrl,
      additional_notes: form.notes || null,
      screenshot_url: path,
      status: "pending",
      payment_status: paymentStatus === "verified" ? "paid" : "pending",
    });
    if (insErr) throw insErr;

    // Record the payment
    await supabase.from("release_payments").insert({
      user_id: user.id,
      amount: PAYMENT_AMOUNT,
      payment_method: "lenco_inline",
      phone_number: paymentPhone,
      transaction_id: transactionId,
      status: paymentStatus,
      verified_at: paymentStatus === "verified" ? new Date().toISOString() : null,
    });

    setSubmitted(true);
  };

  // Step 2: trigger Lenco payment
  const handlePayment = () => {
    if (!paymentPhone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number before proceeding.",
        variant: "destructive",
      });
      return;
    }

    if (typeof LencoPay === "undefined") {
      toast({
        title: "Error",
        description: "Payment system is loading. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const reference = `verification-${user.id}-${Date.now()}`;

    LencoPay.getPaid({
      key: LENCO_PUBLIC_KEY,
      reference,
      email: user.email,
      amount: PAYMENT_AMOUNT,
      currency: "ZMW",
      channels: ["card", "mobile-money"],
      customer: {
        firstName: profile?.full_name?.split(" ")[0] || "Customer",
        lastName: profile?.full_name?.split(" ").slice(1).join(" ") || "",
        phone: paymentPhone,
      },
      onSuccess: async (response) => {
        try {
          await submitVerification(response.reference, "verified");
          toast({
            title: "Payment Successful!",
            description: "Your verification request has been submitted.",
          });
        } catch (err: any) {
          toast({ title: "Submission failed", description: err.message, variant: "destructive" });
        } finally {
          setLoading(false);
        }
      },
      onClose: () => {
        setLoading(false);
        toast({
          title: "Payment Cancelled",
          description: "You closed the payment window. No charge was made.",
        });
      },
      onConfirmationPending: async () => {
        try {
          await submitVerification(reference, "pending");
          toast({
            title: "Payment Submitted!",
            description: "Your payment will be verified shortly.",
          });
        } catch (err: any) {
          toast({ title: "Submission failed", description: err.message, variant: "destructive" });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 max-w-xl">
          <Card className="shadow-card">
            <CardContent className="pt-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <h2 className="text-2xl font-bold">Submitted!</h2>
              <p className="text-muted-foreground">
                ✅ Your verification request has been submitted! Our team will review it and get back to you within 2–5 business days.
              </p>
              <Button onClick={() => navigate("/dashboard")} variant="hero">Back to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!platform) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center">Artist Verification</h1>
          <p className="text-center text-muted-foreground mb-8">Choose a platform to claim your official artist profile.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            {(["spotify", "boomplay"] as Platform[]).map((p) => (
              <Card
                key={p}
                className={`shadow-card hover:shadow-glow cursor-pointer transition-all border-2 ${META[p].color}`}
                onClick={() => selectPlatform(p)}
              >
                <CardHeader>
                  <div className="text-5xl mb-2">{META[p].emoji}</div>
                  <CardTitle>{p === "spotify" ? "Spotify Artist Verification" : "Boomplay Artist Verification"}</CardTitle>
                  <CardDescription>
                    Claim your official artist profile on {p === "spotify" ? "Spotify" : "Boomplay"}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="hero">Start Verification</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Payment step
  if (step === "payment") {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-lg mx-auto">
            <Button variant="ghost" onClick={() => setStep("form")} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to form
            </Button>
            <Card className="shadow-card">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Artist Verification Payment</CardTitle>
                <CardDescription className="text-3xl font-bold text-foreground mt-2">
                  K{PAYMENT_AMOUNT}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="paymentPhone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="paymentPhone"
                    type="tel"
                    placeholder="e.g. 0971234567"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the phone number associated with your mobile money account.
                  </p>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                  <h3 className="font-semibold mb-2 text-primary">Secure Checkout</h3>
                  <p className="text-sm text-muted-foreground">
                    Pay securely via Mobile Money or Card. Click the button below to open the payment window.
                  </p>
                </div>

                <Button
                  onClick={handlePayment}
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-6 text-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Pay K{PAYMENT_AMOUNT}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Form step
  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-2xl">
        <Button variant="ghost" onClick={() => setPlatform(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to platforms
        </Button>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" /> {META[platform].title}
            </CardTitle>
            <CardDescription>{META[platform].subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <Label>Artist Name (as it appears on {platform === "spotify" ? "Spotify" : "Boomplay"}) *</Label>
                <Input value={form.artistName} onChange={(e) => setForm({ ...form, artistName: e.target.value })} required />
              </div>
              {platform === "spotify" && (
                <div>
                  <Label>Spotify Artist Profile URL *</Label>
                  <Input
                    type="url"
                    placeholder="https://open.spotify.com/artist/..."
                    value={form.spotifyUrl}
                    onChange={(e) => setForm({ ...form, spotifyUrl: e.target.value })}
                    required
                  />
                </div>
              )}
              <div>
                <Label>Full Legal Name *</Label>
                <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} required />
              </div>
              <div>
                <Label>Email Address *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label>{platform === "boomplay" ? "Mobile Number" : "Phone Number"} (with country code) *</Label>
                <Input type="tel" placeholder="+260..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div>
                <Label>Distributor Name *</Label>
                <Input value={form.distributor} onChange={(e) => setForm({ ...form, distributor: e.target.value })} required />
              </div>
              <div>
                <Label>Social Media Profile URL (Instagram, Twitter, or Facebook) *</Label>
                <Input
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={form.socialUrl}
                  onChange={(e) => setForm({ ...form, socialUrl: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Upload Social Media Screenshot * (jpg/png, max 5MB)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Take a screenshot showing you're logged in as the admin/owner of the artist page.
                </p>
              </div>
              <div>
                <Label>Additional Notes (optional)</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button type="submit" variant="hero" className="w-full">
                Continue to Payment (K{PAYMENT_AMOUNT})
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyClaim;