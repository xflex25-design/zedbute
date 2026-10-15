import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Check, Clock, ExternalLink, ShieldCheck } from "lucide-react";

const ZMW_PER_USD = 25;
const usd = (zmw: number) => `≈ $${(zmw / ZMW_PER_USD).toFixed(2)} USD`;

const PLANS = [
  {
    id: "monthly" as const,
    name: "Monthly",
    price: 170,
    period: "per month",
    tagline: "Flexible, cancel anytime",
    highlight: false,
  },
  {
    id: "yearly" as const,
    name: "Yearly",
    price: 500,
    period: "per year",
    tagline: "Save K1,540 vs paying monthly",
    highlight: true,
  },
];

const FEATURES = [
  "Full access to music.zedbute.com",
  "Stream and enjoy premium music content",
  "New content added regularly",
  "Works on any device",
];

type Subscription = {
  id: string;
  plan: string;
  status: string;
  payment_status: string;
  expires_at: string | null;
  created_at: string;
};

const Premium = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (searchParams.get("subscribed") === "1") {
      toast({
        title: "Payment received!",
        description: "Our team will approve your Premium access within 24 hours.",
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("premium_subscriptions" as any)
      .select("id, plan, status, payment_status, expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSubscription((data as Subscription | null) ?? null));
  }, [user]);

  const subscribe = (plan: (typeof PLANS)[number]) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate(`/payment?type=premium&plan=${plan.id}&amount=${plan.price}`);
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Helmet>
        <title>Premium | ZedBute</title>
        <meta name="description" content="ZedBute Premium — monthly or yearly access to music.zedbute.com. K170/month or K500/year." />
        <link rel="canonical" href="https://www.zedbute.com/premium" />
      </Helmet>
      <Navbar />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 sm:pb-16" data-testid="premium-page">
        <div className="text-center mb-8 sm:mb-12 max-w-2xl mx-auto">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 text-balance">
            ZedBute Premium
          </h1>
          <p className="text-base xs:text-lg sm:text-xl text-muted-foreground px-2">
            One subscription unlocks full access to <strong>music.zedbute.com</strong> — our premium music platform.
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
          {PLANS.map((plan) => (
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
                  {FEATURES.map((feature) => (
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
              <strong className="text-foreground">How approval works:</strong> after you pay, our team manually reviews and approves your Premium account within <strong className="text-foreground">24 hours</strong>. Once approved, your access to music.zedbute.com is active for your full subscription period — one month or one year. Pay via Mobile Money (Airtel, MTN, Zamtel) or card.
            </p>
          </div>
          {subscription?.status === "pending_approval" && (
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Approval in progress</Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default Premium;
