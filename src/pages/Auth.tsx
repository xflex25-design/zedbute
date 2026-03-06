import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music2, ArrowLeft } from "lucide-react";
import { z } from "zod";

const cleanPhone = (val: string) => val.replace(/[\s\-()]/g, "");

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255).optional(),
  phone: z.string().regex(/^\+260\d{9}$/, { message: "Phone must be in format +260XXXXXXXXX" }).optional(),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
  fullName: z.string().trim().max(100).optional(),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone number is required"
});

type ResetStep = "idle" | "enter_email" | "enter_code";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  // Listen for password recovery event (from email link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setResetStep("enter_code");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Auto-prepend +260 if user starts typing digits without it
    if (val && !val.startsWith("+") && /^\d/.test(val)) {
      if (val.startsWith("260")) {
        val = "+" + val;
      } else if (val.startsWith("0")) {
        val = "+260" + val.slice(1);
      } else {
        val = "+260" + val;
      }
    }
    setPhone(cleanPhone(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanedPhone = cleanPhone(phone);
      const validationData = {
        email: usePhone ? undefined : email,
        phone: usePhone ? cleanedPhone : undefined,
        password,
        fullName: !isLogin ? fullName : undefined,
      };

      authSchema.parse(validationData);

      if (isLogin) {
        const credentials = usePhone
          ? { phone: cleanedPhone, password }
          : { email, password };

        const { error } = await supabase.auth.signInWithPassword(credentials);

        if (error) {
          toast({
            title: "Login failed",
            description: error.message.includes("Invalid")
              ? `Invalid ${usePhone ? "phone number" : "email"} or password. Please try again.`
              : error.message,
            variant: "destructive",
          });
        } else {
          toast({ title: "Welcome back!", description: "You've successfully logged in." });
          navigate("/dashboard");
        }
      } else {
        // Sign up
        const signUpData = usePhone
          ? {
              phone: cleanedPhone,
              password,
              options: { data: { full_name: fullName } },
            }
          : {
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/`,
                data: { full_name: fullName },
              },
            };

        const { error, data } = await supabase.auth.signUp(signUpData);

        if (error) {
          const isRegistered = error.message.includes("already registered");
          toast({
            title: isRegistered ? "Account exists" : "Error",
            description: isRegistered
              ? `This ${usePhone ? "phone number" : "email"} is already registered. Please login instead.`
              : error.message,
            variant: "destructive",
          });
        } else {
          // Update profile with phone number if signing up with phone
          if (usePhone && data.user) {
            await supabase
              .from("profiles")
              .update({ phone_number: cleanedPhone })
              .eq("id", data.user.id);
          }
          toast({
            title: "Account created!",
            description: usePhone
              ? "You can now login with your phone number."
              : "Please check your email to verify your account, then login.",
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to reset your password.",
        variant: "destructive",
      });
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
          description: "Check your inbox for a password reset link. Click it to set a new password.",
        });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
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

  // Render password recovery - set new password
  if (resetStep === "enter_code") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Music2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={100}
                />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setResetStep("idle"); setNewPassword(""); }}
              >
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
          <div className="flex justify-center mb-4">
            <Music2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {resetStep === "enter_email" ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {resetStep === "enter_email"
              ? "Enter your email to receive a password recovery link"
              : isLogin
                ? "Login to access your music distribution dashboard"
                : "Start distributing your music worldwide"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetStep === "enter_email" ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Sending..." : "Send Recovery Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setResetStep("idle")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    maxLength={100}
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setUsePhone(false)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    !usePhone
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Email
                </button>
                <span className="text-muted-foreground">or</span>
                <button
                  type="button"
                  onClick={() => setUsePhone(true)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    usePhone
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Phone
                </button>
              </div>

              {usePhone ? (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+260XXXXXXXXX"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                    maxLength={13}
                  />
                  <p className="text-xs text-muted-foreground">Format: +260 followed by 9 digits</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={100}
                />
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
              </Button>
            </form>
          )}
          {isLogin && resetStep === "idle" && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => setResetStep("enter_email")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}
          {resetStep === "idle" && (
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Login"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
