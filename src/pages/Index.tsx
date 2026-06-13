import { useEffect, useState } from "react";
import { Helmet } from 'react-helmet-async';
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Music, Sparkles, Globe, Shield, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import heroBg from "@/assets/hero-bg.jpg";
import { PlatformLogos } from "@/components/PlatformLogos";
import mpakaFye from "@/assets/mpaka-fye.jpg.asset.json";
import elcZulu from "@/assets/elc-zulu.jpg.asset.json";

const faqs = [
  { q: "How do I distribute my music with ZedBute?", a: "Sign up, upload your track and cover art, fill in your release metadata, choose a plan, and pay securely with mobile money or card. We deliver your music to Spotify, Apple Music, TikTok and 150+ platforms." },
  { q: "How long does music distribution take?", a: "Most releases go live on major platforms within 1–7 business days after submission, depending on each store's review process. We recommend submitting at least 2 weeks before your release date." },
  { q: "Do I keep 100% of your royalties?", a: "Yes. ZedBute never takes a cut of your streaming or download royalties. You pay a flat plan fee and keep everything you earn from streams and sales." },
  { q: "Which platforms can I distribute to?", a: "Spotify, Apple Music, YouTube Music, TikTok, Amazon Music, Deezer, Tidal, Boomplay and 150+ more digital stores and streaming services worldwide." },
  { q: "Can I distribute music from Zambia?", a: "Absolutely. ZedBute is built for Zambian and African artists. You can pay in ZMW via Airtel Money, MTN MoMo, or card through our secure Lenco integration." },
  { q: "Do I need to be a verified artist?", a: "No, anyone can distribute. But getting verified through ZedBute boosts your credibility on streaming platforms and unlocks artist profile control on Spotify and Apple Music." },
];

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useSEO({
    title: "ZedBute | Music Distribution for Zambian & Independent Artists",
    description: "Distribute your music to Spotify, Apple Music, TikTok & 150+ platforms. Keep 100% of your royalties. Built for Zambian and independent artists.",
    canonical: "https://zedbute-net.lovable.app/",
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session) {
              navigate("/dashboard");
         }
    });

    return () => subscription.unsubscribe();
  }, []);

  const features = [
    { icon: Globe, title: "Global Distribution", description: "Reach 150+ streaming platforms worldwide including Spotify, Apple Music, and more" },
    { icon: TrendingUp, title: "100% Royalties", description: "Keep all your earnings. We never take a percentage of your royalties" },
    { icon: Shield, title: "Artist Verification", description: "Get verified and build credibility with your audience and platforms" },
    { icon: Users, title: "Team Features", description: "Collaborate with your team, split payments, and manage multiple artists" },
    { icon: Sparkles, title: "Advanced Analytics", description: "Track your performance with detailed insights and real-time data" },
    { icon: Music, title: "Unlimited Releases", description: "Upload as many singles, EPs, and albums as you want with no limits" },
  ];

  return (
    <>
      <Helmet>
        <meta name="google-site-verification" content="google5381a056419580bb" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        
        {/* Hero Section */}
        <section
          className="relative pt-24 sm:pt-28 md:pt-32 lg:pt-40 pb-16 sm:pb-20 lg:pb-28 px-4 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(rgba(220, 25, 5, 0.8), rgba(220, 25, 5, 0.9)), url(${heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="container mx-auto text-center relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 text-foreground leading-tight">
              Distribute Your Music
              <span className="block bg-gradient-primary bg-clip-text text-transparent">
                To The World
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-foreground/90 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
              Join thousands of artists distributing their music to Spotify, Apple Music, TikTok, and 150+ platforms. Keep 100% of your royalties.
            </p>
            <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
              <Button
                size="lg"
                variant="hero"
                onClick={() => navigate(user ? "/dashboard" : "/auth")}
                className="text-base sm:text-lg px-6 sm:px-8"
              >
                {user ? "Go to Dashboard" : "Start Distributing"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/pricing")}
                className="text-base sm:text-lg px-6 sm:px-8 bg-background/20 backdrop-blur-sm border-foreground/20 hover:bg-background/30"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </section>

        {/* Platform Logos */}
        <PlatformLogos />

        {/* Features Section */}
        <section className="py-12 sm:py-16 lg:py-20 px-4 bg-gradient-hero">
          <div className="container mx-auto">
            <div className="text-center mb-10 sm:mb-12 lg:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
                Everything You Need To Succeed
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
                Professional music distribution tools built for independent artists
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="shadow-card hover:shadow-glow transition-shadow duration-300">
                  <CardHeader className="p-4 sm:p-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-lg sm:text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Artists We've Worked With */}
{[
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260609-WA0066(1).jpg", title: "MR GBP ", artist: "Emcee zm" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260604-WA0239.jpg", title: "You Are Holy", artist: "Elc. Zulu" },
  { src: "/images/rockners.jpg", title: "birthday to you", artist: "Bambiwamafruities" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/20260606_081535.jpg", title: "Baoyo", artist: "Ice Fam" },
  { src: "https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260613-WA0107.jpg", title: "BARS AFTER BARS", artist: "Dope suvage" }, // this one is for you
].map((a, index) => (
  <div
    key={index}
    className="group rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition-shadow"
  >
    <div className="aspect-square overflow-hidden bg-muted">
      <img
        src={a.src}
        alt={`${a.title} by ${a.artist} – distributed by ZedBute`}
        loading="lazy"
        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    </div>
    <div className="p-4 bg-card">
      <p className="font-bold text-lg">{a.title}</p>
      <p className="text-sm text-muted-foreground">{a.artist}</p>
    </div>
  </div>
))}


        </section>

        {/* FAQ Section */}
        <section className="py-12 sm:py-16 lg:py-20 px-4 bg-background">
          <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">Frequently Asked Questions</h2>
              <p className="text-base sm:text-lg text-muted-foreground">Everything you need to know about distributing your music with ZedBute</p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-base sm:text-lg">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm sm:text-base text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 sm:py-16 lg:py-20 px-4 bg-gradient-primary">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-primary-foreground">
              Ready to Share Your Music?
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-primary-foreground/90 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              Join ZedBute today and start distributing your music to millions of listeners worldwide
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate(user ? "/dashboard" : "/auth")}
              className="text-base sm:text-lg px-6 sm:px-8"
            >
              {user ? "Go to Dashboard" : "Get Started Free"}
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 sm:py-12 lg:py-16 px-4 border-t border-border bg-card">
          <div className="container mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 lg:gap-12 mb-8 sm:mb-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Music className="h-8 w-8 text-primary" />
                  <span className="text-2xl font-bold">
                    <span className="text-green-500">zed</span>
                    <span className="text-red-500">B</span>
                    <span className="text-foreground">ute</span>
                  </span>
                </div>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Empowering independent artists to distribute their music globally. Keep 100% of your royalties.
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground">Quick Links</h4>
                <div className="flex flex-col gap-2">
                  <a href="/pricing" className="text-muted-foreground hover:text-primary transition-colors text-sm">Pricing</a>
                  <a href="/auth" className="text-muted-foreground hover:text-primary transition-colors text-sm">Get Started</a>
                  <a href="/verify" className="text-muted-foreground hover:text-primary transition-colors text-sm">Artist Verification</a>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground">Connect With Us</h4>
                <div className="flex gap-4">
                  <a href="https://www.facebook.com/61585895670071/posts/122116059987196522/?app=fbl" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center hover:bg-[#1877F2] hover:text-white transition-all duration-300 text-[#1877F2]"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                  <a href="https://www.tiktok.com/@zedbute?_r=1&_t=ZS-94OnQPySvxJ" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#ff0050]/10 flex items-center justify-center hover:bg-[#ff0050] hover:text-white transition-all duration-300 text-[#ff0050]"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>
                  <a href="https://wa.me/260974119780" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-all duration-300 text-[#25D366]"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
                  <a href="mailto:Zedbute@gmail.com" className="w-10 h-10 rounded-full bg-[#EA4335]/10 flex items-center justify-center hover:bg-[#EA4335] hover:text-white transition-all duration-300 text-[#EA4335]"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></a>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>📧 Zedbute@gmail.com</p>
                  <p>📱 +260974119780</p>
                  <p>📱 +260969359952</p>
                </div> 
              </div>
            </div>
            <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} ZedBute. All rights reserved.</p>
              <p className="text-xs text-muted-foreground">Distribute. Earn. Grow. 🎵</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
