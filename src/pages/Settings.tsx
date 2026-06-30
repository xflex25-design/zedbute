import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Key, ShieldCheck, AlertTriangle } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const hasPasswordProvider = (identities: { provider: string }[] | undefined | null) =>
  identities?.some((id) => id.provider === "email") ?? false;

const Settings = () => {
  const { user, loading: authLoading, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const hasPassword = hasPasswordProvider(user?.identities);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      toast({
        title: "Validation Error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const error = await updatePassword(password);
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      setSuccessMessage(hasPassword
        ? "Password updated! You can now log in with your new password."
        : "Password set! You can now also log in with your email and password."
      );
      setPassword("");
      setConfirmPassword("");
      toast({
        title: hasPassword ? "Password updated" : "Password set",
        description: hasPassword
          ? "Your password has been changed successfully."
          : "A password has been added to your account.",
      });
    }
    setSubmitting(false);
  };

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
        <meta name="description" content="Manage your account settings and password." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-lg">

          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Account Settings</h1>
          <p className="text-sm text-muted-foreground mb-6">Manage your account security and preferences</p>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {hasPassword ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : (
                  <Key className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg">
                    {hasPassword ? "Change Password" : "Set Password"}
                  </CardTitle>
                  <CardDescription>
                    {hasPassword
                      ? "Update your current password"
                      : "You signed up with Google. Add a password to also log in with email."
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {successMessage && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                  <ShieldCheck className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-600">{successMessage}</p>
                </div>
              )}

              {!hasPassword && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-600">
                    You currently don't have a password. Once set, you can log in using either Google or email.
                  </p>
                </div>
              )}

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="At least 6 characters"
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
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={100}
                  />
                </div>
                <Button type="submit" className="w-full" variant="hero" disabled={submitting}>
                  {submitting ? "Saving..." : hasPassword ? "Update Password" : "Set Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
};

export default Settings;
