import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ZedBute | Settings</title>
        <meta name="description" content="Manage your account settings." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-lg">

          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Account Settings</h1>
          <p className="text-sm text-muted-foreground mb-6">Manage your account</p>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Profile</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{user?.email}</span>
              </div>
              {user?.user_metadata?.username && (
                <div>
                  <span className="text-muted-foreground">Username: </span>
                  <span className="font-medium">{user.user_metadata.username}</span>
                </div>
              )}
              {user?.user_metadata?.full_name && (
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">{user.user_metadata.full_name}</span>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
};

export default Settings;
