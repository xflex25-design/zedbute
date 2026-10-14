import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Music, Disc3, Disc } from "lucide-react";
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
      "Distribute to Boomplay & Spotify",
      "Keep 100% of your royalties",
      "Pay securely via Mobile Money",
      "Processing within 2 weeks",
    ],
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
      "Distribute to Boomplay & Spotify",
      "Keep 100% of your royalties",
      "Pay securely via Mobile Money",
      "Processing within 2 weeks",
    ],
    highlight: true,
    testid: "pricing-ep-card",
  },
  {
    icon: Disc,
    name: "Album",
    price: 500,
    tagline: "8+ tracks",
    features: [
      "8 or more tracks per release",
      "Distribute to Boomplay & Spotify",
      "Keep 100% of your royalties",
      "Pay securely via Mobile Money",
      "Processing within 2 weeks",
    ],
    highlight: false,
    testid: "pricing-album-card",
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="text-center mb-8 xs:mb-10 sm:mb-12 md:mb-16 max-w-2xl mx-auto">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 xs:mb-4 text-balance">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base xs:text-lg sm:text-xl text-muted-foreground px-2">
            One-time fee per release. No subscriptions. No hidden costs. Prices in Zambian Kwacha (K) with the US Dollar equivalent.
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
                <ul className="space-y-2.5 mb-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
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

        <div className="mt-10 max-w-2xl mx-auto text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Artist verification (Spotify / YouTube) carries a one-time processing fee of <strong>K260</strong> ({usd(260)}).
          </p>
          <p className="text-sm text-muted-foreground">
            Pay in Kwacha via Mobile Money (Airtel, MTN, Zamtel) or by card. USD amounts are approximate at K{ZMW_PER_USD} = $1 and shown for reference only — you are charged in ZMW.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
