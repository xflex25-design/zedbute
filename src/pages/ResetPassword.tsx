import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "error">("loading");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        setShowForm(true);
        setStatus("ready");
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (cancelled) return;
          if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
            setShowForm(true);
            setStatus("ready");
          }
        }
      );

      setTimeout(() => {
        if (cancelled) return;
        if (!session && !showForm) {
          setStatus("error");
        }
      }, 5000);

      return () => {
        subscription.unsubscribe();
      };
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setStatus("done");
        toast({ title: "Password updated!", description: "You can now login with your new password." });
        await supabase.auth.signOut();
        setTimeout(() => navigate("/auth"), 2000);
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Music2 className="h-12 w-12 text-primary" />
          </div>
          {status === "loading" && (
            <>
              <CardTitle className="text-2xl">Checking Session</CardTitle>
              <CardDescription>Verifying your reset link...</CardDescription>
            </>
          )}
          {status === "ready" && (
            <>
              <CardTitle className="text-2xl">Set New Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </>
          )}
          {status === "done" && (
            <>
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Password Updated
              </CardTitle>
              <CardDescription>Redirecting you to login...</CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                Invalid Link
              </CardTitle>
              <CardDescription>
                This password reset link is invalid or has expired.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {status === "ready" && showForm && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={100}
                />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}

          {status === "error" && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
              Return to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
