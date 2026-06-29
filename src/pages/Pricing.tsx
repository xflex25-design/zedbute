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
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="text-center mb-8 xs:mb-10 sm:mb-12 md:mb-16 max-w-2xl mx-auto">
          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 xs:mb-4 text-balance">
            Simple, Transparent Pricing
          </h1>
          <p className="text-base xs:text-lg sm:text-xl text-muted-foreground px-2">
            One flat fee. No subscriptions. No hidden costs.
          </p>
        </div>

        <div className="max-w-xs sm:max-w-md mx-auto">
          <Card className="shadow-glow border-primary relative transition-transform hover:-translate-y-1 duration-300 mx-4 sm:mx-0">
            <div className="absolute -top-3 xs:-top-4 left-1/2 -translate-x-1/2 px-2 xs:px-4 py-0.5 xs:py-1 rounded-full text-xs xs:text-sm font-semibold text-primary-foreground">
              Release Upload
            </div>
            <CardHeader className="text-center pt-6 xs:pt-8">
              <div className="mx-auto mb-3 xs:mb-4 h-12 xs:h-14 w-12 xs:w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Music className="h-6 xs:h-7 w-6 xs:w-7 text-primary" />
              </div>
              <CardTitle className="text-xl xs:text-2xl">Upload Your Release</CardTitle>
              <div className="mt-3 xs:mt-4">
                <span className="text-4xl xs:text-5xl font-bold">K50</span>
              </div>
              <CardDescription className="mt-1 xs:mt-2 text-sm xs:text-base">
                Per release, one-time payment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 xs:space-y-3 mb-5 xs:mb-6">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 xs:gap-2">
                    <Check className="h-4 xs:h-5 w-4 xs:w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm xs:text-base">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="hero"
                className="w-full hover:scale-105 transition-transform h-10 xs:h-11"
                onClick={() => navigate(user ? "/upload-release" : "/auth")}
              >
                {user ? "Upload a Release" : "Get Started"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Payments accepted via Mobile Money (Airtel, MTN, Zamtel) and Card through Lenco.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
