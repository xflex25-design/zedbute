import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music2, ArrowLeft, Phone, Mail } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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

type ResetStep = "idle" | "choose_method" | "enter_email" | "enter_phone" | "verify_otp" | "set_new_password";

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
  const [otpCode, setOtpCode] = useState("");
  const [resetPhone, setResetPhone] = useState("");
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setResetStep("set_new_password");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
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

  const handleResetPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val && !val.startsWith("+") && /^\d/.test(val)) {
      if (val.startsWith("260")) {
        val = "+" + val;
      } else if (val.startsWith("0")) {
        val = "+260" + val.slice(1);
      } else {
        val = "+260" + val;
      }
    }
    setResetPhone(cleanPhone(val));
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

  const handlePhoneOtpSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanPhone(resetPhone);
    if (!/^\+260\d{9}$/.test(cleaned)) {
      toast({ title: "Invalid phone", description: "Phone must be in format +260XXXXXXXXX", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: cleaned });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Code sent!",
          description: "Enter the 6-digit code we sent to your phone.",
        });
        setResetStep("verify_otp");
      }
    } catch {
      toast({ title: "Error", description: "Failed to send SMS. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({ title: "Invalid code", description: "Please enter the full 6-digit code.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: cleanPhone(resetPhone),
        token: otpCode,
        type: "sms",
      });
      if (error) {
        toast({ title: "Verification failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Phone verified!", description: "Now set your new password." });
        setResetStep("set_new_password");
      }
    } catch {
      toast({ title: "Error", description: "Verification failed.", variant: "destructive" });
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
        setOtpCode("");
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
    if (resetStep === "verify_otp") setResetStep("enter_phone");
    else if (resetStep === "enter_phone" || resetStep === "enter_email") setResetStep("choose_method");
    else { setResetStep("idle"); setNewPassword(""); setOtpCode(""); }
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

  // Verify OTP screen
  if (resetStep === "verify_otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><Music2 className="h-12 w-12 text-primary" /></div>
            <CardTitle className="text-2xl">Enter Verification Code</CardTitle>
            <CardDescription>We sent a 6-digit code to {resetPhone}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading || otpCode.length !== 6}>
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
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
            {resetStep === "choose_method" ? "Reset Password"
              : resetStep === "enter_email" ? "Reset via Email"
              : resetStep === "enter_phone" ? "Reset via SMS"
              : isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {resetStep === "choose_method" ? "Choose how you'd like to recover your account"
              : resetStep === "enter_email" ? "We'll send a recovery link to your email"
              : resetStep === "enter_phone" ? "We'll send a verification code via SMS"
              : isLogin ? "Login to access your music distribution dashboard"
              : "Start distributing your music worldwide"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Choose recovery method */}
          {resetStep === "choose_method" && (
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-14"
                onClick={() => setResetStep("enter_email")}>
                <Mail className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Reset via Email</p>
                  <p className="text-xs text-muted-foreground">Receive a recovery link in your inbox</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-14"
                onClick={() => setResetStep("enter_phone")}>
                <Phone className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Reset via SMS</p>
                  <p className="text-xs text-muted-foreground">Receive a 6-digit code on your phone</p>
                </div>
              </Button>
              <Button type="button" variant="ghost" className="w-full mt-2" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Button>
            </div>
          )}

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

          {/* Phone reset form */}
          {resetStep === "enter_phone" && (
            <form onSubmit={handlePhoneOtpSend} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-phone">Phone Number</Label>
                <Input id="reset-phone" type="tel" placeholder="+260XXXXXXXXX" value={resetPhone}
                  onChange={handleResetPhoneChange} required maxLength={13} />
                <p className="text-xs text-muted-foreground">Format: +260 followed by 9 digits</p>
              </div>
              <Button type="submit" className="w-full" variant="hero" disabled={loading}>
                {loading ? "Sending..." : "Send Recovery Code"}
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
                  const { error } = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (error) {
                    toast({ title: "Google login failed", description: String(error), variant: "destructive" });
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
                      onChange={(e) => setFullName(e.target.value)} required={!isLogin} maxLength={100} />
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-sm">
                  <button type="button" onClick={() => setUsePhone(false)}
                    className={`px-3 py-1 rounded-md transition-colors ${!usePhone ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    Email
                  </button>
                  <span className="text-muted-foreground">or</span>
                  <button type="button" onClick={() => setUsePhone(true)}
                    className={`px-3 py-1 rounded-md transition-colors ${usePhone ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    Phone
                  </button>
                </div>

                {usePhone ? (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="+260XXXXXXXXX" value={phone}
                      onChange={handlePhoneChange} required maxLength={13} />
                    <p className="text-xs text-muted-foreground">Format: +260 followed by 9 digits</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
                  </div>
                )}
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
                  <button type="button" onClick={() => setResetStep("choose_method")}
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
