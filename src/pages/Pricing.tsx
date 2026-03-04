import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Pricing = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const plans = [
    {
      name: "Starter",
      price: "K339",
      period: "/year",
      features: [
        "Distribute to 10+ platforms",
        "Keep 100% of your royalties",
        "Basic analytics",
        "Email support",
        "Pay via mobile money",
      ],
    },
    {
      name: "Pro",
      price: "K799",
      period: "/year",
      popular: true,
      features: [
        "Distribute to 150+ platforms",
        "Keep 100% of your royalties",
        "Advanced analytics & insights",
        "Priority support",
        "Custom label name",
        "Split payments",
        "Pay via mobile money",
      ],
    },
    {
      name: "Label",
      price: "K1999",
      period: "/year",
      features: [
        "Unlimited artist accounts",
        "All Pro features",
        "White-label options",
        "Dedicated account manager",
        "API access",
        "Team collaboration",
        "Pay via mobile money",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-12">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">Simple, Transparent Pricing</h1>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            Choose the plan that fits your music career. Cancel anytime.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`shadow-card relative ${
                plan.popular ? "border-primary shadow-glow sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-primary px-4 py-1 rounded-full text-sm font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">
                  For {plan.name === "Starter" ? "emerging" : plan.name === "Pro" ? "professional" : "established"} artists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.popular ? "hero" : "outline"}
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 sm:mt-12 lg:mt-16 text-center">
          <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
            All plans include unlimited releases and keep 100% of your royalties.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Payment accepted via Airtel Money, Zamtel Kwacha, and MTN Mobile Money
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
