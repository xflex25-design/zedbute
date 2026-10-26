import { useEffect, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListMusic, Globe, Shield, TrendingUp, Wallet, Banknote, Send, Check, Star, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { PlatformLogos } from "@/components/PlatformLogos";
import emailjs from "@emailjs/browser";

const EMAILJS = {
  publicKey: "y6dBkyYNeiQ5-ONrT",
  serviceId: "service_m5ipkn6",
  templateId: "template_h6m0hkf",
};

const SectionLabel = ({ index, children }: { index: string; children: React.ReactNode }) => (
  <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground mb-4">
    <span className="h-2 w-2 rounded-full bg-primary" />
    {index} · {children}
  </p>
);

const faqs = [
  { q: "How do I distribute my music with ZedBute?", a: "Sign up, upload your track and cover art, fill in your release metadata, choose a plan, and pay securely with mobile money or card. We deliver your music to Spotify, Apple Music, TikTok and 150+ platforms." },
  { q: "How long does music distribution take?", a: "Most releases go live on major platforms within 1–7 business days after submission, depending on each store's review process. We recommend submitting at least 2 weeks before your release date." },
  { q: "Do I keep 100% of your royalties?", a: "Yes. ZedBute never takes a cut of your streaming or download royalties. You pay a flat plan fee and keep everything you earn from streams and sales." },
  { q: "Which platforms can I distribute to?", a: "Spotify, Apple Music, YouTube Music, TikTok, Amazon Music, Deezer, Tidal, Boomplay and 150+ more digital stores and streaming services worldwide." },
  { q: "Can I distribute music from Zambia?", a: "Absolutely. ZedBute is built for Zambian and African artists. You can pay in ZMW via Airtel Money, MTN MoMo, or card through our secure Pesapal integration." },
  { q: "Do I need to be a verified artist?", a: "No, anyone can distribute. But getting verified through ZedBute boosts your credibility on streaming platforms and unlocks artist profile control on Spotify and Apple Music." },
];

const homePlans = [
  {
    label: "// // SINGLE",
    price: "K50",
    usd: "≈ $2.00",
    blurb: "One track, delivered worldwide.",
    cta: "CHOOSE SINGLE",
    path: "/upload-release",
    highlight: false,
    testid: "home-plan-single",
    features: ["1 track per release", "150+ platforms", "Keep 100% of royalties", "Mobile money or card", "Live within ~2 weeks"],
  },
  {
    label: "// // EP",
    price: "K200",
    usd: "≈ $8.00",
    blurb: "Up to 7 tracks in one release.",
    cta: "CHOOSE EP",
    path: "/upload-ep",
    highlight: true,
    testid: "home-plan-ep",
    features: ["Everything in Single", "Up to 7 tracks", "Keep 100% of royalties", "Mobile money or card", "Live within ~2 weeks"],
  },
  {
    label: "// // ALBUM",
    price: "K500",
    usd: "≈ $20.00",
    blurb: "Your full project, everywhere.",
    cta: "CHOOSE ALBUM",
    path: "/upload-album",
    highlight: false,
    testid: "home-plan-album",
    features: ["Everything in EP", "8 or more tracks", "Keep 100% of royalties", "Mobile money or card", "Live within ~2 weeks"],
  },
];

const artists = [
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260609-WA0066(1).jpg", title: "MR GBP", artist: "Emcee zm" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/1780489640980.jpg", title: "You Are Holy", artist: "Elc. Zulu" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260604-WA0239.jpg", title: "Birthday to You", artist: "Bambiwamafruities" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/20260606_081535.jpg", title: "Baoyo", artist: "Ice Fam" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/Gioconda_(copia_del_Museo_del_Prado_restaurada).jpg", title: "Mona Lisa", artist: "Wizzo zm" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/1764965608368.jpg", title: "mpaka fye", artist: "Emi ft sensedanger" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/InShot_20260613_172906691.jpg", title: "You let me dawn", artist: "Lildney ft jea stones" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260613-WA0107.jpg", title: "Bars After Bars", artist: "Dope suvage" },
];

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sendingContact, setSendingContact] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast({ title: "Missing fields", description: "Please complete all fields.", variant: "destructive" });
      return;
    }
    setSendingContact(true);
    try {
      await emailjs.init(EMAILJS.publicKey);
      await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
        from_name: contactName,
        from_email: contactEmail,
        message: contactMessage,
      });
      toast({ title: "Message sent", description: "We will respond within 24 hours." });
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch (error: any) {
      toast({ title: "Send failed", description: error?.text || error?.message || "Try again later.", variant: "destructive" });
    } finally {
      setSendingContact(false);
    }
  };

  useSEO({
    title: "ZedBute | Music Distribution for Zambian & Independent Artists",
    description: "Distribute your music to Spotify, Apple Music, TikTok & 150+ platforms. Keep 100% of your royalties. Built for Zambian and independent artists.",
    canonical: "https://www.zedbute.com/",
    keywords: "music distribution, distribute music free, keep 100% royalties, independent artist music distribution, Zambian music distribution",
  });

  useEffect(() => {
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
    document.head.appendChild(ld);
    return () => { document.head.removeChild(ld); };
  }, []);

  const features = [
    { icon: Globe, title: "Global Distribution", description: "Reach 150+ streaming platforms worldwide including Spotify, Apple Music, and more" },
    { icon: TrendingUp, title: "100% Royalties", description: "Keep all your earnings. We never take a percentage of your royalties" },
    { icon: Shield, title: "Artist Verification", description: "Get verified and build credibility with your audience and platforms" },
    { icon: Wallet, title: "Mobile Money Payments", description: "Pay with Airtel Money, MTN MoMo, Zamtel or card — in Kwacha, with USD shown for reference" },
    { icon: ListMusic, title: "Playlist Promotion", description: "Submit your releases to curated playlists and grow your audience" },
    { icon: Banknote, title: "Royalty Payouts", description: "Track your earnings and request withdrawals straight from your dashboard" },
  ];

  return (
    <>
      <Helmet>
        <meta name="google-site-verification" content="google5381a056419580bb" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navbar />

        {/* Hero Section — live video background */}
        <section
          className="relative pt-24 sm:pt-28 md:pt-32 lg:pt-40 pb-16 sm:pb-20 lg:pb-28 px-4 overflow-hidden"
        >
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster="/artist-recording.jpg"
            aria-hidden="true"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/65 to-primary/50" />
          <div className="container mx-auto text-center relative z-10 animate-fade-in">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-white/70 mb-6">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Music distribution · Zambia to the world
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold uppercase tracking-tighter leading-[0.95] mb-6 text-white drop-shadow-lg text-balance">
              Distribute your music
              <span className="block text-amber-300 drop-shadow-lg">
                To The World
              </span>
            </h1>
            <p className="text-base xs:text-lg sm:text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto px-2 drop-shadow text-balance">
              Get your music on Spotify, Apple Music, TikTok, and 150+ platforms. Keep 100% of your royalties.
            </p>
            <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
              <Button
                size="lg"
                variant="hero"
                className="rounded-full px-8"
                onClick={() => user ? navigate('/dashboard') : navigate('/auth')}
              >
                {user ? "Go to Dashboard" : "Start Distributing"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/pricing")}
                className="rounded-full px-8 bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </section>

        {/* Platform Logos */}
        <PlatformLogos />

        {/* Features Section */}
        <section className="py-16 sm:py-20 lg:py-24 px-4 bg-gradient-hero">
          <div className="container mx-auto">
            <div className="text-center mb-12 sm:mb-16 lg:mb-20">
              <SectionLabel index="01">Why ZedBute</SectionLabel>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[0.95] mb-4 text-balance">
                Everything you need.
                <span className="block text-primary">Nothing you don't.</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Professional music distribution tools built for independent artists
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {features.map((feature, index) => (
                <Card key={feature.title} className="rounded-3xl animate-fade-in transition-all duration-300 hover:scale-[1.02] hover:shadow-glow hover:-translate-y-1 cursor-default" style={{ animationDelay: `${index * 100}ms` }}>
                  <CardHeader className="p-6 sm:p-8">
                    <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110">
                      <feature.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Artists We've Worked With */}
        <section className="py-16 sm:py-20 lg:py-24 px-4 bg-muted/30">
          <div className="container mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <SectionLabel index="02">Artists</SectionLabel>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-[0.95] mb-4 text-balance">
                Artists we've
                <span className="text-primary"> worked with.</span>
              </h2>
              <p className="text-base text-muted-foreground">Trending releases distributed globally via ZedBute</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {artists.map((a, index) => (
                <div
                  key={index}
                  className="group relative rounded-3xl overflow-hidden shadow-card hover:shadow-glow hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={a.src}
                      alt={`${a.title} by ${a.artist} – distributed by ZedBute`}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-10">
                    <p className="font-bold text-white leading-tight">{a.title}</p>
                    <p className="text-sm text-white/70">{a.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing preview — Ditto-style plan cards */}
        <section className="py-16 sm:py-20 lg:py-24 px-4 bg-background">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-16">
              <SectionLabel index="03">Pricing</SectionLabel>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[0.95] mb-4 text-balance">
                Pick a plan.
                <span className="block text-primary">Start releasing.</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                One price per release. 100% royalties and our full artist toolkit included with every plan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {homePlans.map((plan) => (
                <div
                  key={plan.label}
                  data-testid={plan.testid}
                  className={`relative rounded-3xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-card border border-border shadow-card"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black text-primary px-4 py-1.5 rounded-full text-xs font-bold tracking-widest inline-flex items-center gap-1.5">
                      <Star className="h-3 w-3 fill-primary" /> MOST POPULAR
                    </div>
                  )}
                  <p className={`text-xs font-bold tracking-[0.25em] ${plan.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.label}
                  </p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-6xl sm:text-7xl font-extrabold tracking-tighter leading-none">{plan.price}</span>
                    <span className={`text-sm mb-1.5 ${plan.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      one-time<br />{plan.usd}
                    </span>
                  </div>
                  <p className={`mt-4 text-base ${plan.highlight ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                    {plan.blurb}
                  </p>
                  <Button
                    data-testid={`${plan.testid}-cta`}
                    onClick={() => navigate(user ? plan.path : "/auth")}
                    className={`mt-6 w-full h-12 rounded-full font-bold tracking-widest text-sm ${
                      plan.highlight
                        ? "bg-black text-white hover:bg-black/85"
                        : "bg-foreground text-background hover:opacity-90"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                  <div className={`my-6 h-px ${plan.highlight ? "bg-primary-foreground/25" : "bg-border"}`} />
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          plan.highlight ? "bg-black" : "bg-green-500"
                        }`}>
                          <Check className={`h-3 w-3 ${plan.highlight ? "text-primary" : "text-white"}`} strokeWidth={3.5} />
                        </span>
                        <span className="text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8">
              Want unlimited uploads with analytics and platform choice?{" "}
              <a href="/premium" className="text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity" data-testid="home-premium-link">
                See ZedBute Premium
              </a>
            </p>
          </div>
        </section>

        {/* Brand Promise — photo backdrop */}
        <section className="relative py-16 sm:py-20 lg:py-24 px-4 overflow-hidden">
          <img
            src="/artist-keys.jpg"
            alt="Artist producing music on a keyboard in the studio"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/75" />
          <div className="container mx-auto max-w-4xl text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tighter leading-[0.95] mb-6 text-balance text-white">
              Made for independent artists.
            </h2>
            <p className="text-xl sm:text-2xl lg:text-3xl leading-relaxed text-white/85 text-balance">
              &ldquo;Your music, your masters, your money. Keep 100% ownership and 100% of your royalties &mdash; always.&rdquo;
            </p>
            <p className="mt-6 text-sm uppercase tracking-widest text-primary font-semibold">The ZedBute Promise</p>
          </div>
        </section>

        {/* Artist Resources */}
        <section className="py-16 sm:py-20 lg:py-24 px-4 bg-muted/30">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <SectionLabel index="04">Resources</SectionLabel>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-[0.95] mb-4 text-balance">
                Grow with
                <span className="text-primary"> artist resources.</span>
              </h2>
              <p className="text-lg text-muted-foreground">Guides and tools to release and promote your music</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-primary">The ZedBute Blog</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Practical tips on releasing and promoting music as an independent artist in Zambia and beyond.</p>
                <a href="/blog" data-testid="resources-blog-link" className="inline-flex items-center gap-1 text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity">Visit the blog <ArrowRight className="h-4 w-4" /></a>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-primary">Artist Verification</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Claim and verify your artist profiles to build credibility on streaming platforms.</p>
                <a href="/verify" data-testid="resources-verify-link" className="inline-flex items-center gap-1 text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity">Get verified <ArrowRight className="h-4 w-4" /></a>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-primary">Simple Pricing</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">One-time fees per release in Kwacha with USD shown &mdash; no subscriptions, no hidden costs.</p>
                <a href="/pricing" data-testid="resources-pricing-link" className="inline-flex items-center gap-1 text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity">See pricing <ArrowRight className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 sm:py-20 lg:py-24 px-4 bg-background">
          <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-12 sm:mb-16">
              <SectionLabel index="05">FAQ</SectionLabel>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-[0.95] mb-4 text-balance">
                Questions?
                <span className="text-primary"> Answered.</span>
              </h2>
              <p className="text-lg text-muted-foreground">Everything you need to know about distributing your music with ZedBute</p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-lg">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Contact — send us an email */}
        <section className="py-16 sm:py-20 lg:py-24 px-4 bg-muted/30">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="rounded-3xl overflow-hidden shadow-glow order-2 lg:order-1">
                <img
                  src="/artist-studio.jpg"
                  alt="Smiling artist playing guitar in a professional recording studio"
                  loading="lazy"
                  className="h-full w-full object-cover aspect-[4/3]"
                />
              </div>
              <div className="order-1 lg:order-2">
                <SectionLabel index="06">Contact</SectionLabel>
                <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-[0.95] mb-3 text-balance">
                  Talk
                  <span className="text-primary"> to us.</span>
                </h2>
                <p className="text-muted-foreground mb-6">
                  Questions about distribution, verification or Premium? Send us an email straight from here &mdash; we reply within 24 hours.
                </p>
                <form onSubmit={handleContactSubmit} className="space-y-4" data-testid="home-contact-form">
                  <div className="space-y-2">
                    <Label htmlFor="home-contact-name">Name</Label>
                    <Input
                      id="home-contact-name"
                      data-testid="home-contact-name"
                      placeholder="Your name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-contact-email">Email</Label>
                    <Input
                      id="home-contact-email"
                      data-testid="home-contact-email"
                      type="email"
                      placeholder="you@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      maxLength={255}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-contact-message">Message</Label>
                    <Textarea
                      id="home-contact-message"
                      data-testid="home-contact-message"
                      placeholder="How can we help?"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      maxLength={2000}
                      rows={4}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full sm:w-auto rounded-full px-8"
                    data-testid="home-contact-submit"
                    disabled={sendingContact}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingContact ? "Sending..." : "Send Email"}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20 sm:py-24 lg:py-32 px-4 bg-gradient-to-br from-primary via-red-600 to-secondary relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)]" />
          <div className="container mx-auto text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tighter leading-[0.95] mb-6 text-primary-foreground text-balance">
              Ready to share your music?
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
              Join ZedBute today and start distributing your music to millions of listeners worldwide
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full px-10"
              onClick={() => navigate(user ? "/dashboard" : "/auth")}
            >
              {user ? "Go to Dashboard" : "Get Started"}
            </Button>
          </div>
        </section>

        {/* Footer — black, Ditto style */}
        <footer className="bg-black text-white py-14 sm:py-16 px-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="ZedBute logo" className="h-10 w-10 rounded-lg" />
                  <span className="text-2xl font-bold">
                    <span className="text-green-500">zed</span>
                    <span className="text-red-500">B</span>
                    <span className="text-white">ute</span>
                  </span>
                </div>
                <p className="text-white/60 text-sm max-w-xs leading-relaxed">
                  ZedBute is the home of independent artists. Distribute your music worldwide, keep 100% of your royalties and stay independent.
                </p>
                <div className="flex gap-3">
                  <a href="https://www.facebook.com/profile.php?id=61590202035568" target="_blank" rel="noopener noreferrer" aria-label="ZedBute on Facebook" data-testid="social-facebook" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-primary hover:border-primary transition-all duration-300"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                  <a href="https://www.tiktok.com/@zedbute?_r=1&_t=ZN-9AYsoXgVa6A" target="_blank" rel="noopener noreferrer" aria-label="ZedBute on TikTok" data-testid="social-tiktok" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-primary hover:border-primary transition-all duration-300"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>
                  <a href="https://youtube.com/@zedbute?si=HnOmubMe4s44pOp5" target="_blank" rel="noopener noreferrer" aria-label="ZedBute on YouTube" data-testid="social-youtube" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-primary hover:border-primary transition-all duration-300"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg></a>
                  <a href="https://instagram.com/zedbute?psln=MTFmeHJlYXBjdGpldQ%3D%3D" target="_blank" rel="noopener noreferrer" aria-label="ZedBute on Instagram" data-testid="social-instagram" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-primary hover:border-primary transition-all duration-300"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg></a>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-white/40">Get Started</h4>
                <div className="flex flex-col gap-2.5">
                  <a href="/auth" className="text-white/70 hover:text-white transition-colors text-sm">Sign Up</a>
                  <a href="/pricing" className="text-white/70 hover:text-white transition-colors text-sm">Pricing</a>
                  <a href="/premium" className="text-white/70 hover:text-white transition-colors text-sm">Premium</a>
                  <a href="/blog" className="text-white/70 hover:text-white transition-colors text-sm">Blog</a>
                  <a href="/verify" className="text-white/70 hover:text-white transition-colors text-sm">Artist Verification</a>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-white/40">Legal</h4>
                <div className="flex flex-col gap-2.5">
                  <a href="/privacy" data-testid="footer-privacy-link" className="text-white/70 hover:text-white transition-colors text-sm">Privacy &amp; Cookie Policy</a>
                  <a href="/terms" data-testid="footer-terms-link" className="text-white/70 hover:text-white transition-colors text-sm">Terms of Service</a>
                  <a href="/refund-policy" data-testid="footer-refund-link" className="text-white/70 hover:text-white transition-colors text-sm">Refund Policy</a>
                  <a href="/contact" className="text-white/70 hover:text-white transition-colors text-sm">Contact</a>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-white/40">Contact</h4>
                <div className="space-y-2.5 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    <span>Zedbute@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>+260974119780</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>+260969359952</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-white/50">&copy; {new Date().getFullYear()} ZedBute. All rights reserved.</p>
              <p className="text-xs uppercase tracking-[0.25em] text-white/40">Distribute. Earn. Grow.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
