import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Music } from "lucide-react";
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

  const features = [
    "One-time fee per release",
    "Distribute to Boomplay & Spotify",
    "Keep 100% of your royalties",
    "Pay securely via Mobile Money or Card (Lenco)",
    "Processing within 2 weeks",
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-12">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            One flat fee. No subscriptions. No hidden costs.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="shadow-glow border-primary relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-primary px-4 py-1 rounded-full text-sm font-semibold text-primary-foreground">
                Release Upload
              </span>
            </div>
            <CardHeader className="text-center pt-8">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Upload Your Release</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">K50</span>
              </div>
              <CardDescription className="mt-2">
                Per release, one-time payment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="hero"
                className="w-full"
                onClick={() => navigate(user ? "/upload-release" : "/auth")}
              >
                {user ? "Upload a Release" : "Get Started"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Payments accepted via Mobile Money (Airtel, MTN, Zamtel) and Card through Lenco.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
