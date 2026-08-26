import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Music, ShieldCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const plans = [
  {
    id: "monthly",
    name: "Monthly Plan",
    amount: 200,
    cadence: "month",
    description: "Flexible access for artists building momentum.",
    icon: Zap,
    features: ["Distribute to 100+ platforms", "Manage unlimited releases", "Artist profile & catalog", "Detailed analytics", "Royalty earnings", "Priority support"],
  },
  {
    id: "annual",
    name: "Annual Plan",
    amount: 500,
    cadence: "year",
    description: "The best value for a year of consistent releases.",
    icon: Crown,
    features: ["Everything in Monthly", "12 months of distribution", "Priority review queue", "Advanced catalog support", "Royalty earnings", "Dedicated support"],
  },
] as const;

const Pricing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
  }, []);

  const selected = plans.find((plan) => plan.id === billing) ?? plans[1];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pb-16 pt-28 sm:pt-32">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Music className="size-7" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary">Built for independent artists</p>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">Simple pricing. Powerful results.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">Choose the plan that keeps your music moving. Pay once, distribute everywhere, and keep 100% of your royalties.</p>
        </section>

        <div className="mx-auto mt-10 flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1">
          {plans.map((plan) => (
            <button key={plan.id} type="button" onClick={() => setBilling(plan.id)} className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${billing === plan.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {plan.id === "annual" ? "Annual" : "Monthly"}
            </button>
          ))}
        </div>

        <section className="mx-auto mt-8 grid max-w-5xl gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const active = billing === plan.id;
            return (
              <Card key={plan.id} className={`relative overflow-hidden transition-all ${active ? "border-primary shadow-glow" : "border-border"}`}>
                {plan.id === "annual" && <div className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">BEST VALUE</div>}
                <CardHeader className="p-7 pb-4">
                  <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="leading-relaxed">{plan.description}</CardDescription>
                  <div className="pt-4"><span className="text-5xl font-bold tracking-tight">K{plan.amount}</span><span className="ml-2 text-muted-foreground">/ {plan.cadence}</span></div>
                  <p className="text-sm text-muted-foreground">Billed every {plan.id === "annual" ? "365" : "30"} days</p>
                </CardHeader>
                <CardContent className="p-7 pt-2">
                  <ul className="flex flex-col gap-3 border-t border-border py-6">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{feature}</li>)}</ul>
                  <Button className="w-full" variant={active ? "hero" : "outline"} onClick={() => navigate(user ? `/payment?type=subscription&plan=${plan.id}&amount=${plan.amount}` : "/auth")}>{user ? `Choose ${plan.id === "annual" ? "Annual" : "Monthly"} Plan` : "Get Started"}</Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-3 text-center text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Secure mobile-money payment through Lenco. No hidden fees.</div>
      </main>
    </div>
  );
};

export default Pricing;
