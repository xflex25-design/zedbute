import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music2, ArrowLeft } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setShowForm(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setShowForm(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (password !== confirmPassword) {
        toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
        return;
      }
      if (password.length < 6) {
        toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Password updated!", description: "You can now login with your new password." });
        await supabase.auth.signOut();
        navigate("/auth");
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-sm sm:max-w-md shadow-card">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="flex justify-center mb-4"><Music2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary" /></div>
          <CardTitle className="text-xl sm:text-2xl">Set New Password</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {showForm ? "Enter your new password below" : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <Input id="new-password" type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={100}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm">Confirm Password</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} maxLength={100}
                  className="h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10" variant="hero" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
              <Button type="button" variant="ghost" className="w-full h-10" onClick={() => navigate("/auth")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Button>
            </form>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <p>No valid reset session found.</p>
              <Button type="button" variant="link" onClick={() => navigate("/auth")}>
                Return to login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
