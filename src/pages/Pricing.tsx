import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Music, Disc3, Disc, Crown, Clock, ShieldCheck, ExternalLink, Globe, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ZMW_PER_USD = 25;
const usd = (zmw: number) => `≈ $${(zmw / ZMW_PER_USD).toFixed(2)} USD`;

const plans = [
  {
    icon: Music,
    name: "Single",
    price: 50,
    tagline: "One track",
    features: [
      "1 track per release",
      "150+ platforms (Spotify, Apple, Boomplay, Audiomack, TikTok)",
      "Keep 100% of royalties",
      "Pay with Mobile Money or Card",
      "Live within ~2 weeks",
    ],
    footerNote: "No yearly fee. Never taken down.",
    highlight: false,
    testid: "pricing-single-card",
  },
  {
    icon: Disc3,
    name: "EP",
    price: 200,
    tagline: "Up to 7 tracks",
    features: [
      "Up to 7 tracks per release",
      "150+ platforms (Spotify, Apple, Boomplay, Audiomack, TikTok)",
      "Keep 100% of royalties",
      "Pay with Mobile Money or Card",
      "Live within ~2 weeks",
    ],
    footerNote: "No yearly fee. Never taken down.",
    highlight: true,
    testid: "pricing-ep-card",
  },
  {
    icon: Disc,
    name: "Album",
    price: 500,
    tagline: "8+ tracks",
    features: [
      "Up to 15+ tracks per release",
      "150+ platforms (Spotify, Apple, Boomplay, Audiomack, TikTok)",
      "Keep 100% of royalties",
      "Pay with Mobile Money or Card",
      "Live within ~2 weeks",
    ],
    footerNote: "No yearly fee. Never taken down.",
    highlight: false,
    testid: "pricing-album-card",
  },
];

const premiumPlans = [
  {
    id: "monthly",
    name: "Monthly",
    price: 170,
    period: "per month",
    tagline: "Flexible, cancel anytime",
    highlight: false,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: 500,
    period: "per year",
    tagline: "Save K1,540 vs paying monthly",
    highlight: true,
  },
];

const premiumFeatures = [
  "Full access to music.zedbute.com",
  "Unlimited uploads for your whole subscription period",
  "See your analytics — streams, listeners and performance",
  "Choose which platforms you distribute to",
];

type Subscription = {
  id: string;
  plan: string;
  status: string;
  payment_status: string;
  expires_at: string | null;
  created_at: string;
};

const Pricing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        supabase
          .from("premium_subscriptions" as any)
          .select("id, plan, status, payment_status, expires_at, created_at")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => setSubscription((data as Subscription | null) ?? null));
      }
    });
  }, []);

  const subscribe = (plan: (typeof premiumPlans)[number]) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate(`/payment?type=premium&plan=${plan.id}&amount=${plan.price}`);
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 sm:pb-16">
        {/* Top Header */}
        <div className="text-center mb-8 xs:mb-10 sm:mb-12 md:mb-14 max-w-2xl mx-auto">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 xs:mb-4 text-balance">
            Simple, Zambian Pricing. In Kwacha.
          </h1>
          <p className="text-base xs:text-lg sm:text-xl text-muted-foreground px-2">
            No dollars. No yearly renewals unless you want them. Keep 100% royalties, always.
          </p>
        </div>

        {/* Section Title above one-time cards */}
        <div className="text-center mb-8 max-w-2xl mx-auto">
          <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold mb-2 text-balance">
            Pay Once. Your Music Stays Forever.
          </h2>
          <p className="text-sm xs:text-base text-muted-foreground">
            Best for singles, EPs, albums. Live on Spotify, Boomplay, TikTok & 150+ stores.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              data-testid={plan.testid}
              className={`relative transition-transform hover:-translate-y-1 duration-300 ${plan.highlight ? "shadow-glow border-primary" : "shadow-card"}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <CardHeader className="text-center pt-6 xs:pt-8">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <plan.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl xs:text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.tagline}</CardDescription>
                <div className="mt-3 space-y-1">
                  <div className="text-4xl font-bold" data-testid={`${plan.testid}-price-zmw`}>K{plan.price}</div>
                  <div className="text-sm text-muted-foreground" data-testid={`${plan.testid}-price-usd`}>{usd(plan.price)}</div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground text-center mb-5 italic">
                  {plan.footerNote}
                </p>
                <Button
                  variant="hero"
                  className="w-full hover:scale-105 transition-transform h-10"
                  data-testid={`${plan.testid}-cta`}
                  onClick={() => navigate(user ? "/upload-release" : "/auth")}
                >
                  {user ? "Upload a Release" : "Get Started"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison line below 3 cards */}
        <div className="mt-8 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            DistroKid charges $22.99/year EVERY year. ZedBute: K50 once. Forever.
          </p>
        </div>

        {/* Trust-building badges / icons */}
        <div className="mt-6 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-3.5 rounded-lg bg-card/60 border border-border/60 flex items-center justify-center gap-2.5 shadow-sm">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium">100% Secure</span>
          </div>
          <div className="p-3.5 rounded-lg bg-card/60 border border-border/60 flex items-center justify-center gap-2.5 shadow-sm">
            <Globe className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium">Zambian Owned</span>
          </div>
          <div className="p-3.5 rounded-lg bg-card/60 border border-border/60 flex items-center justify-center gap-2.5 shadow-sm">
            <Headphones className="h-5 w-5 text-primary shrink-0" />
            <span className="text-sm font-medium">Support 24/7</span>
          </div>
        </div>

        <div className="mt-6 max-w-2xl mx-auto text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Artist verification (Spotify / YouTube) carries a one-time processing fee of <strong>K260</strong> ({usd(260)}).
          </p>
          <p className="text-sm text-muted-foreground">
            Pay in Kwacha via Mobile Money (Airtel, MTN, Zamtel) or by card. USD amounts are approximate at K{ZMW_PER_USD} = $1 and shown for reference only — you are charged in ZMW.
          </p>
        </div>

        {/* Premium Section */}
        <div className="mt-20 pt-12 border-t border-border">
          <div className="text-center mb-8 max-w-2xl mx-auto">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold mb-3 text-balance">
              OR GO UNLIMITED - ZedBute Premium
            </h2>
            <p className="text-base xs:text-lg text-muted-foreground px-2">
              One subscription unlocks full access to music.zedbute.com — our premium artist platform with analytics & unlimited uploads.
            </p>
          </div>

          {subscription && (
            <div className="max-w-2xl mx-auto mb-8" data-testid="premium-status-card">
              {subscription.status === "pending_approval" ? (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-500">
                      {subscription.plan === "yearly" ? "Yearly" : "Monthly"} Premium — pending approval
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your payment was received. Our team approves every account manually — you'll get access within 24 hours.
                    </p>
                  </div>
                </div>
              ) : subscription.status === "approved" ? (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-500">
                      {subscription.plan === "yearly" ? "Yearly" : "Monthly"} Premium — active
                      {subscription.expires_at && ` until ${new Date(subscription.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                    <a
                      href="https://music.zedbute.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="premium-open-music-link"
                      className="text-sm text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity inline-flex items-center gap-1 mt-1"
                    >
                      Open music.zedbute.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {premiumPlans.map((plan) => (
              <Card
                key={plan.id}
                data-testid={`premium-${plan.id}-card`}
                className={`relative transition-transform hover:-translate-y-1 duration-300 ${plan.highlight ? "shadow-glow border-primary" : "shadow-card"}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground">
                    Best Value
                  </div>
                )}
                <CardHeader className="text-center pt-8">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.tagline}</CardDescription>
                  <div className="mt-3 space-y-1">
                    <div className="text-4xl font-bold" data-testid={`premium-${plan.id}-price`}>K{plan.price}</div>
                    <div className="text-sm text-muted-foreground">{plan.period} · {usd(plan.price)}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 mb-6">
                    {premiumFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="hero"
                    className="w-full hover:scale-105 transition-transform"
                    data-testid={`premium-${plan.id}-subscribe`}
                    onClick={() => subscribe(plan)}
                  >
                    Subscribe {plan.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 max-w-2xl mx-auto space-y-3 text-center">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                After you pay, our team manually reviews and approves your Premium account within 24 hours. Once approved, your access to music.zedbute.com is unlocked.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
