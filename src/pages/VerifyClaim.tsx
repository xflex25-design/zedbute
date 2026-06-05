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
import { ArrowLeft, CheckCircle2, Loader2, Music } from "lucide-react";

type Platform = "spotify" | "boomplay";

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
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
    });
  }, [navigate]);

  const selectPlatform = (p: Platform) => {
    setPlatform(p);
    setForm((f) => ({ ...f, phone: META[p].defaultPhone }));
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${platform}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("verification-screenshots")
        .upload(path, file, { upsert: false });
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
        payment_status: "not_required",
      } as any);
      if (insErr) throw insErr;

      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit {platform === "spotify" ? "Spotify" : "Boomplay"} Verification
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyClaim;
