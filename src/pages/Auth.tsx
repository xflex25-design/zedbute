import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetStep = "idle" | "enter_email";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signIn, signUp, resetPassword } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });

        const error = await signIn(email, password);
        if (error) {
          toast({
            title: "Login failed",
            description: error,
            variant: "destructive",
          });
        } else {
          toast({ title: "Welcome back!", description: "You've successfully logged in." });
          navigate("/dashboard");
        }
      } else {
        if (!agreeToTerms) {
          toast({
            title: "Terms required",
            description: "Please agree to the Terms of Service and Privacy Policy to create an account.",
            variant: "destructive",
          });
          return;
        }
        signupSchema.parse({ fullName, email: signupEmail, password, confirmPassword });

        const { error, needsConfirmation } = await signUp(signupEmail, password, fullName);
        if (error) {
          const isRegistered = error.includes("already registered");
          toast({
            title: isRegistered ? "Account exists" : "Error",
            description: isRegistered
              ? "This email is already registered. Please login instead."
              : error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account created!",
            description: needsConfirmation
              ? "Check your email for a confirmation link, then login."
              : "You're logged in! Welcome to ZedBute.",
          });
          if (!needsConfirmation) {
            navigate("/dashboard");
          } else {
            setEmail(signupEmail);
            setIsLogin(true);
            setConfirmPassword("");
          }
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const error = await resetPassword(recoverEmail);
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
      } else {
        toast({
          title: "Recovery email sent!",
          description: "Check your inbox for a password reset link.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast({ title: "Google login failed", description: error.message, variant: "destructive" });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const goBack = () => {
    if (resetStep === "enter_email") setResetStep("idle");
  };

  const anyLoading = loading || googleLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md shadow-card animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><img src="/logo.png" alt="ZedBute logo" className="h-14 w-14 rounded-xl" /></div>
          <CardTitle className="text-2xl">
            {resetStep === "enter_email" ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {resetStep === "enter_email" ? "Enter your email to reset your password" : isLogin ? "Login to access your music distribution dashboard" : "Start distributing your music worldwide"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetStep === "enter_email" && (
            <form onSubmit={handleEmailReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" placeholder="you@example.com" value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)} required maxLength={255} />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={anyLoading}>
                {loading ? "Sending..." : "Send Recovery Link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={goBack} disabled={anyLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </form>
          )}

          {resetStep === "idle" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={handleGoogleLogin}
                disabled={anyLoading}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {googleLoading ? "Redirecting..." : "Continue with Google"}
              </Button>

              <div className="flex items-center gap-3 my-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input id="fullName" type="text" placeholder="John Doe" value={fullName}
                        onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupEmail">Email</Label>
                      <Input id="signupEmail" type="email" placeholder="you@example.com" value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)} required maxLength={255} />
                    </div>
                  </>
                )}

                {isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                      onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={100} />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} maxLength={100} />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="agreeToTerms"
                        data-testid="signup-terms-checkbox"
                        checked={agreeToTerms}
                        onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                      />
                      <Label htmlFor="agreeToTerms" className="text-sm text-muted-foreground font-normal leading-snug cursor-pointer">
                        I agree to the{" "}
                        <a href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</a>
                        {" "}and{" "}
                        <a href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>
                      </Label>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" variant="hero" disabled={anyLoading}>
                  {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
                </Button>
              </form>
              {isLogin && (
                <div className="mt-2 flex flex-col items-center gap-1">
                  <button type="button" onClick={() => setResetStep("enter_email")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
                    disabled={anyLoading}>
                    Forgot password?
                  </button>
                </div>
              )}
              <div className="mt-4 text-center text-sm">
                  <button type="button" onClick={() => {
                    if (isLogin) {
                      setSignupEmail(email);
                    } else {
                      setEmail(signupEmail);
                    }
                    setConfirmPassword("");
                    setIsLogin(!isLogin);
                  }} className="text-primary hover:underline transition-all duration-200"
                    disabled={anyLoading}>
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
