import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ChevronRight,
  CircleCheck as CheckCircle2,
  ImagePlus,
  Loader as Loader2,
  Music,
  Phone,
  Search,
  Trash2,
  Zap,
} from "lucide-react";

type Platform = "spotify" | "boomplay";

interface MBArtist {
  id: string;
  name: string;
  country?: string;
  type?: string;
  score?: number;
}

const LENCO_PUBLIC_KEY = "pub-6f90c9d7234ba5738a66ac8036942f6200ab2da1851e0e0c";
const PAYMENT_AMOUNT = 50;

const COUNTRY_CODES = [
  { code: "+260", label: "ZM +260" },
  { code: "+27",  label: "ZA +27"  },
  { code: "+233", label: "GH +233" },
  { code: "+234", label: "NG +234" },
  { code: "+254", label: "KE +254" },
  { code: "+255", label: "TZ +255" },
  { code: "+256", label: "UG +256" },
  { code: "+250", label: "RW +250" },
  { code: "+243", label: "CD +243" },
  { code: "+265", label: "MW +265" },
  { code: "+263", label: "ZW +263" },
  { code: "+267", label: "BW +267" },
  { code: "+264", label: "NA +264" },
  { code: "+1",   label: "US +1"   },
  { code: "+44",  label: "GB +44"  },
];

const META: Record<Platform, { title: string; subtitle: string; gradient: string; border: string; badge: string }> = {
  spotify: {
    title: "Spotify for Artists Verification",
    subtitle: "We'll submit your claim to Spotify for Artists on your behalf.",
    gradient: "from-emerald-950/60 to-emerald-900/30",
    border: "border-emerald-500/60 hover:border-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  boomplay: {
    title: "Boomplay for Artists Verification",
    subtitle: "Claim your official Boomplay artist profile.",
    gradient: "from-blue-950/60 to-blue-900/30",
    border: "border-blue-500/60 hover:border-blue-400",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
};

const VerifyClaim = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [step, setStep] = useState<"form" | "payment">("form");

  // MusicBrainz search
  const [artistSearch, setArtistSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MBArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [form, setForm] = useState({
    artistName: "",
    spotifyUrl: "",
    boomplayUrl: "",
    legalName: "",
    email: "",
    phone: "+260",
    phoneCountry: "+260",
    phoneLocal: "",
    distributor: "ZedBute",
    socialUrl: "",
    notes: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Auth + profile load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      setForm((f) => ({ ...f, email: session.user.email || "" }));
      supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          setProfile(data);
          if (data?.phone_number) setPaymentPhone(data.phone_number);
        });
    });
  }, [navigate]);

  // Debounced MusicBrainz search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!artistSearch.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artistSearch)}&limit=7&fmt=json`,
          { headers: { "User-Agent": "Zedbute/1.0 ( info@zedbute.com )" } }
        );
        const data = await res.json();
        setSearchResults(data.artists || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [artistSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectArtistResult = (artist: MBArtist) => {
    setForm((f) => ({ ...f, artistName: artist.name }));
    setArtistSearch(artist.name);
    setShowDropdown(false);
  };

  const selectPlatform = (p: Platform) => {
    setPlatform(p);
    setSubmitted(false);
    setStep("form");
    setFile(null);
    setFilePreview(null);
    setArtistSearch("");
    setSearchResults([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
  };

  const fullBoomplayPhone = form.phoneCountry + form.phoneLocal;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !platform) return;

    if (!form.artistName.trim()) {
      toast({ title: "Artist name required", variant: "destructive" }); return;
    }
    if (!form.email.trim()) {
      toast({ title: "Email required", variant: "destructive" }); return;
    }

    if (platform === "spotify") {
      if (!form.spotifyUrl.trim()) {
        toast({ title: "Spotify URL required", variant: "destructive" }); return;
      }
      if (!form.legalName.trim()) {
        toast({ title: "Legal name required", variant: "destructive" }); return;
      }
      if (!form.phone.trim()) {
        toast({ title: "Phone number required", variant: "destructive" }); return;
      }
      if (!form.socialUrl.trim()) {
        toast({ title: "Social media URL required", variant: "destructive" }); return;
      }
    }

    if (platform === "boomplay" && !form.phoneLocal.trim()) {
      toast({ title: "Mobile number required", description: "Please enter your phone number.", variant: "destructive" }); return;
    }

    if (!form.distributor.trim()) {
      toast({ title: "Distributor name required", variant: "destructive" }); return;
    }
    if (!file) {
      toast({ title: "Screenshot required", description: "Please upload a social media screenshot.", variant: "destructive" }); return;
    }

    setStep("payment");
  };

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
      legal_name: platform === "spotify" ? form.legalName : null,
      platform_email: form.email,
      payment_phone_number: platform === "boomplay" ? fullBoomplayPhone : form.phone,
      distributor_name: form.distributor,
      spotify_url: platform === "spotify" ? form.spotifyUrl : null,
      topic_channel_url: platform === "boomplay" ? (form.boomplayUrl || null) : null,
      instagram_url: platform === "spotify" ? form.socialUrl : null,
      additional_notes: form.notes || null,
      screenshot_url: path,
      status: "pending",
      payment_status: paymentStatus === "verified" ? "paid" : "pending",
    });
    if (insErr) throw insErr;

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

  const handlePayment = () => {
    if (!paymentPhone.trim()) {
      toast({ title: "Phone number required", description: "Please enter your mobile money number.", variant: "destructive" }); return;
    }
    if (typeof LencoPay === "undefined") {
      toast({ title: "Payment system loading", description: "Please try again in a moment.", variant: "destructive" }); return;
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
          toast({ title: "Payment Successful!", description: "Your verification request has been submitted." });
        } catch (err: any) {
          toast({ title: "Submission failed", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
      },
      onClose: () => {
        setLoading(false);
        toast({ title: "Payment Cancelled", description: "You closed the payment window. No charge was made." });
      },
      onConfirmationPending: async () => {
        try {
          await submitVerification(reference, "pending");
          toast({ title: "Payment Submitted!", description: "Your payment will be verified shortly." });
        } catch (err: any) {
          toast({ title: "Submission failed", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
      },
    });
  };

  // ── Success ─────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 max-w-xl">
          <Card className="shadow-card">
            <CardContent className="pt-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
              <h2 className="text-2xl font-bold">Submitted!</h2>
              <p className="text-muted-foreground">
                Your verification request has been submitted. Our team will review it and get back to you within 2–5 business days.
              </p>
              <Button onClick={() => navigate("/dashboard")} variant="hero">Back to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Platform picker ──────────────────────────────────────────────────────────
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
                className={`shadow-card cursor-pointer transition-all duration-200 border-2 ${META[p].border} overflow-hidden`}
                onClick={() => selectPlatform(p)}
              >
                <div className={`bg-gradient-to-br ${META[p].gradient} p-6`}>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${META[p].badge} mb-3`}>
                    {p === "spotify" ? "Spotify" : "Boomplay"} for Artists
                  </span>
                  <CardTitle className="text-xl mb-1">
                    {p === "spotify" ? "Spotify Artist Verification" : "Boomplay Artist Verification"}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Claim your official artist profile on {p === "spotify" ? "Spotify" : "Boomplay"}.
                  </CardDescription>
                </div>
                <CardContent className="pt-4 pb-5">
                  <Button className="w-full" variant="hero">Start Verification</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Payment step ─────────────────────────────────────────────────────────────
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
                    Mobile Money Phone Number
                  </Label>
                  <Input
                    id="paymentPhone"
                    type="tel"
                    placeholder="e.g. 0971234567"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the phone number linked to your mobile money account.
                  </p>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                  <h3 className="font-semibold mb-2 text-primary">Secure Checkout</h3>
                  <p className="text-sm text-muted-foreground">Pay securely via Mobile Money or Card.</p>
                </div>

                  <Button
                    onClick={handlePayment}
                    variant="hero"
                    className="w-full"
                    size="lg"
                    disabled={loading}
                  >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                  ) : (
                    <><Zap className="mr-2 h-5 w-5" /> Pay K{PAYMENT_AMOUNT}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── Form step ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-2xl">
        <Button variant="ghost" onClick={() => setPlatform(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to platforms
        </Button>

        <Card className="shadow-card">
          <div className={`bg-gradient-to-br ${META[platform].gradient} px-6 py-5 rounded-t-lg border-b border-border`}>
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              <h2 className="text-lg font-semibold">{META[platform].title}</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{META[platform].subtitle}</p>
          </div>

          <CardContent className="pt-6">
            <form onSubmit={handleFormSubmit} className="space-y-5">

              {/* ── MusicBrainz Artist Search ── */}
              <div className="space-y-1.5" ref={searchContainerRef}>
                <Label className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" />
                  Search Artist on MusicBrainz
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 pr-9"
                    placeholder={`Search for your ${platform === "spotify" ? "Spotify" : "Boomplay"} artist name...`}
                    value={artistSearch}
                    onChange={(e) => setArtistSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    autoComplete="off"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}

                  {/* Results dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-xl overflow-hidden">
                      {searchResults.map((artist) => (
                        <button
                          key={artist.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0 flex items-center justify-between gap-3 group"
                          onClick={() => selectArtistResult(artist)}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{artist.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {artist.type || "Artist"}
                              {artist.country ? ` · ${artist.country}` : ""}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}

                  {showDropdown && !isSearching && artistSearch.trim() && searchResults.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-xl px-4 py-3">
                      <p className="text-sm text-muted-foreground">No artists found. Type your name manually below.</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Search to auto-fill your artist name, or enter it manually in the field below.
                </p>
              </div>

              {/* ── Artist Name ── */}
              <div className="space-y-1.5">
                <Label>
                  Artist Name (as it appears on {platform === "spotify" ? "Spotify" : "Boomplay"}) *
                </Label>
                <Input
                  value={form.artistName}
                  onChange={(e) => setForm({ ...form, artistName: e.target.value })}
                  placeholder="Your artist name on the platform"
                />
              </div>

              {/* ── Spotify-only fields ── */}
              {platform === "spotify" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Spotify Artist Profile URL *</Label>
                    <Input
                      type="url"
                      placeholder="https://open.spotify.com/artist/..."
                      value={form.spotifyUrl}
                      onChange={(e) => setForm({ ...form, spotifyUrl: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Full Legal Name *</Label>
                    <Input
                      value={form.legalName}
                      onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                      placeholder="Your full legal name"
                    />
                  </div>
                </>
              )}

              {/* ── Boomplay profile URL ── */}
              {platform === "boomplay" && (
                <div className="space-y-1.5">
                  <Label>Boomplay Artist Profile URL (optional)</Label>
                  <Input
                    type="url"
                    placeholder="https://www.boomplay.com/artists/..."
                    value={form.boomplayUrl}
                    onChange={(e) => setForm({ ...form, boomplayUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Link to your Boomplay artist page if you have one.
                  </p>
                </div>
              )}

              {/* ── Email Address ── */}
              <div className="space-y-1.5">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>

{/* ── Mobile Number ── */}
              <div className="space-y-1.5">
                <Label>
                  {platform === "boomplay" ? "Mobile Number *" : "Phone Number (with country code) *"}
                </Label>

                <div className={platform === "boomplay" ? "flex flex-col sm:flex-row gap-2" : "w-full"}>
                   {platform === "boomplay" && (
                     <Select
                       value={form.phoneCountry}
                       onValueChange={(v) => setForm({ ...form, phoneCountry: v })}
                     >
                       <SelectTrigger className="w-full sm:w-36 shrink-0 bg-background">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent className="bg-background z-50">
                         {COUNTRY_CODES.map(({ code, label }) => (
                           <SelectItem key={code} value={code}>{label}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   )}
<Input
                      type="tel"
                      placeholder={platform === "boomplay" ? "712345678" : "+260..."}
                      value={platform === "boomplay" ? form.phoneLocal : form.phone}
                      onChange={(e) => platform === "boomplay" 
                        ? setForm({ ...form, phoneLocal: e.target.value.replace(/\D/g, "") })
                        : setForm({ ...form, phone: e.target.value })}
                      className="flex-1 h-10"
                    />
                  </div>

                  {platform === "boomplay" && form.phoneLocal && (
                    <p className="text-xs text-muted-foreground">
                      Full number: {form.phoneCountry}{form.phoneLocal}
                    </p>
                  )}
                </div>

                {/* ── Distributor Name ── */}
              <div className="space-y-1.5">
                <Label>Distributor Name *</Label>
                <Input
                  value={form.distributor}
                  onChange={(e) => setForm({ ...form, distributor: e.target.value })}
                  placeholder="e.g. ZedBute"
                />
              </div>

              {/* ── Social URL — Spotify only ── */}
              {platform === "spotify" && (
                <div className="space-y-1.5">
                  <Label>Social Media Profile URL (Instagram, Twitter, or Facebook) *</Label>
                  <Input
                    type="url"
                    placeholder="https://instagram.com/..."
                    value={form.socialUrl}
                    onChange={(e) => setForm({ ...form, socialUrl: e.target.value })}
                  />
                </div>
              )}

              {/* ── SNS Account / Screenshot ── */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  {platform === "boomplay" ? "Your SNS Account" : "Social Media Screenshot"}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Size: Maximum 5MB. Format: jpg/png/jpeg.
                  {platform === "boomplay" && " Screenshot must show you are logged in as the admin/owner of the artist page."}
                </p>

                <input
                  ref={screenshotInputRef}
                  id="screenshotFile"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {filePreview ? (
                  <div className="relative rounded-lg border border-border overflow-hidden">
                    <img
                      src={filePreview}
                      alt="Screenshot preview"
                      className="w-full max-h-64 object-contain bg-muted"
                    />
                    <button
                      type="button"
                      onClick={removeFile}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <p className="text-xs text-muted-foreground px-3 py-2 border-t border-border bg-background">
                      {file?.name} &middot; {file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => screenshotInputRef.current?.click()}
                    className="w-full h-36 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
                  >
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm">Click to upload screenshot</span>
                  </button>
                )}
              </div>

              {/* ── Notes ── */}
              <div className="space-y-1.5">
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any extra information that might help us process your request..."
                  rows={3}
                />
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
