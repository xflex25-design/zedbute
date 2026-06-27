

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music2, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
  fullName: z.string().trim().max(100).optional(),
});

type ResetStep = "idle" | "enter_email" | "set_new_password";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // FIX 1: Removed duplicate/nested useEffect blocks — replaced with two clean ones
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setResetStep("set_new_password");
        } else if (event === "SIGNED_IN" && session) {
          navigate("/dashboard");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validationData = {
        email,
        password,
        fullName: !isLogin ? fullName : undefined,
      };
      authSchema.parse(validationData);
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast({
            title: "Login failed",
            description: error.message.includes("Invalid")
              ? "Invalid email or password. Please try again."
              : error.message,
            variant: "destructive",
          });
        } else {
          toast({ title: "Welcome back!", description: "You've successfully logged in." });
          navigate("/dashboard");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });

        if (error) {
          const isRegistered = error.message.includes("already registered");
          toast({
            title: isRegistered ? "Account exists" : "Error",
            description: isRegistered
              ? "This email is already registered. Please login instead."
              : error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account created!",
            description: "Please check your email to verify your account, then login.",
          });
          setIsLogin(true);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Recovery email sent!",
          description: "Check your inbox for a password reset link.",
        });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Password updated!", description: "You can now login with your new password." });
        setResetStep("idle");
        setNewPassword("");
        await supabase.auth.signOut();
        setIsLogin(true);
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (resetStep === "enter_email") setResetStep("idle");
    else { setResetStep("idle"); setNewPassword(""); }
  };

  // Set new password screen
  if (resetStep === "set_new_password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><Music2 className="h-12 w-12 text-primary" /></div>
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" placeholder="••••••••" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} required minLength={6} maxLength={100} />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><Music2 className="h-12 w-12 text-primary" /></div>
          <CardTitle className="text-2xl">
            {resetStep === "enter_email" ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {resetStep === "enter_email" ? "Enter your email to reset your password" : isLogin ? "Login to access your music distribution dashboard" : "Start distributing your music worldwide"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Email reset form */}
          {resetStep === "enter_email" && (
            <form onSubmit={handleEmailReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Sending..." : "Send Recovery Link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </form>
          )}

          {/* Main login/signup form */}
          {resetStep === "idle" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={async () => {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: `${window.location.origin}/dashboard`,
                    },
                  });
                  if (error) {
                    toast({ title: "Google login failed", description: error.message, variant: "destructive" });
                  }
                }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 my-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" type="text" placeholder="John Doe" value={fullName}
                      onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={100} />
                </div>
                <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                  {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
                </Button>
              </form>
              {isLogin && (
                <div className="mt-2 text-center">
                  <button type="button" onClick={() => setResetStep("enter_email")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}
              <div className="mt-4 text-center text-sm">
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;