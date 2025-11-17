import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Sparkles, Globe, Shield, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const features = [
    {
      icon: Globe,
      title: "Global Distribution",
      description: "Reach 150+ streaming platforms worldwide including Spotify, Apple Music, and more",
    },
    {
      icon: TrendingUp,
      title: "100% Royalties",
      description: "Keep all your earnings. We never take a percentage of your royalties",
    },
    {
      icon: Shield,
      title: "Artist Verification",
      description: "Get verified and build credibility with your audience and platforms",
    },
    {
      icon: Users,
      title: "Team Features",
      description: "Collaborate with your team, split payments, and manage multiple artists",
    },
    {
      icon: Sparkles,
      title: "Advanced Analytics",
      description: "Track your performance with detailed insights and real-time data",
    },
    {
      icon: Music,
      title: "Unlimited Releases",
      description: "Upload as many singles, EPs, and albums as you want with no limits",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      {/* Hero Section */}
      <section
        className="relative pt-32 pb-20 px-4 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(220, 25, 5, 0.8), rgba(220, 25, 5, 0.9)), url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground">
            Distribute Your Music
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              To The World
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground/90 mb-8 max-w-3xl mx-auto">
            Join thousands of artists distributing their music to Spotify, Apple Music, TikTok, and 150+ platforms. Keep 100% of your royalties.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              variant="hero"
              onClick={() => navigate(user ? "/dashboard" : "/auth")}
              className="text-lg px-8"
            >
              {user ? "Go to Dashboard" : "Start Distributing"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/pricing")}
              className="text-lg px-8 bg-background/20 backdrop-blur-sm border-foreground/20 hover:bg-background/30"
            >
              View Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gradient-hero">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything You Need To Succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional music distribution tools built for independent artists
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="shadow-card hover:shadow-glow transition-shadow duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-primary-foreground">
            Ready to Share Your Music?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join MusicFlow today and start distributing your music to millions of listeners worldwide
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate(user ? "/dashboard" : "/auth")}
            className="text-lg px-8"
          >
            {user ? "Go to Dashboard" : "Get Started Free"}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 MusicFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
