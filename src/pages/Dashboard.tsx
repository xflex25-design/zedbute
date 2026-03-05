import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, CheckCircle2, Clock, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setProfile(profileData);

      // Fetch verification status
      const { data: verificationData } = await supabase
        .from("artist_verifications")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setVerification(verificationData);

      // Fetch releases
      const { data: releasesData } = await supabase
        .from("music_releases")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      setReleases(releasesData || []);

      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-accent" />;
      default:
        return <Music className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8 sm:pb-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
            Welcome, {profile?.full_name || "Artist"}!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your music distribution and verification status
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(verification?.status)}
                Verification Status
              </CardTitle>
              <CardDescription>Artist verification information</CardDescription>
            </CardHeader>
            <CardContent>
              {verification ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Status: <span className="font-semibold capitalize">{verification.status}</span>
                  </p>
                  <p className="text-sm">
                    Payment: <span className="font-semibold capitalize">{verification.payment_status}</span>
                  </p>
                  {verification.status === "pending" && (
                    <p className="text-sm text-muted-foreground">
                      Your application is being reviewed
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get verified to unlock premium distribution features
                  </p>
                  <Button variant="hero" onClick={() => navigate("/verify")}>
                    Apply for Verification
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Manage your music</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/upload-release")}>
                <Upload className="mr-2 h-4 w-4" />
                Upload New Release
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/verify")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Get Verified
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Your Releases</CardTitle>
            <CardDescription>
              {releases.length > 0
                ? `You have ${releases.length} release${releases.length > 1 ? "s" : ""}`
                : "No releases yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {releases.length > 0 ? (
              <div className="space-y-4">
                {releases.map((release) => (
                  <div
                    key={release.id}
                    className="flex flex-col gap-2 p-3 sm:p-4 border border-border rounded-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{release.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">{release.artist_name}</p>
                      </div>
                      <span className="text-sm capitalize px-3 py-1 bg-muted rounded-full self-start sm:self-auto whitespace-nowrap">
                        {release.status}
                      </span>
                    </div>
                    {release.status === "pending" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Distribution Progress</span>
                          <span className="font-medium text-foreground">{release.upload_progress ?? 0}%</span>
                        </div>
                        <Progress value={release.upload_progress ?? 0} className="h-2" />
                        <p className="text-[11px] text-muted-foreground">Processing takes up to 2 weeks</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  You haven't uploaded any releases yet
                </p>
                <Button variant="hero" onClick={() => navigate("/upload-release")}>
                  Upload Your First Release
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
