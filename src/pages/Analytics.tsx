import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ArtistAnalyticsSection } from "@/components/once/ArtistAnalyticsSection";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const Analytics = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-28 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ZedBute | Streaming Analytics</title>
        <meta
          name="description"
          content="View your real streaming performance across Spotify, Apple Music, YouTube Music, and other stores."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-5xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Streaming Analytics</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track streams, store shares, and individual track performance for your releases
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <ArtistAnalyticsSection />
        </div>
      </div>
    </>
  );
};

export default Analytics;
