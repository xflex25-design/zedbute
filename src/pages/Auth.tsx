import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255).optional(),
  phone: z.string().regex(/^\+260\d{9}$/, { message: "Phone must be in format +260XXXXXXXXX" }).optional(),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
  fullName: z.string().trim().max(100).optional(),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone number is required"
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationData = {
        email: usePhone ? undefined : email,
        phone: usePhone ? phone : undefined,
        password,
        fullName: !isLogin ? fullName : undefined,
      };
      
      authSchema.parse(validationData);

      if (isLogin) {
        if (usePhone) {
          const { error } = await supabase.auth.signInWithPassword({
            phone,
            password,
          });

          if (error) {
            toast({
              title: "Login failed",
              description: error.message.includes("Invalid") 
                ? "Invalid phone number or password. Please try again."
                : error.message,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Welcome back!",
              description: "You've successfully logged in.",
            });
            navigate("/dashboard");
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            if (error.message.includes("Invalid login credentials")) {
              toast({
                title: "Login failed",
                description: "Invalid email or password. Please try again.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "Welcome back!",
              description: "You've successfully logged in.",
            });
            navigate("/dashboard");
          }
        }
      } else {
        if (usePhone) {
          const { error, data } = await supabase.auth.signUp({
            phone,
            password,
            options: {
              data: {
                full_name: fullName,
              },
            },
          });

          if (error) {
            toast({
              title: "Error",
              description: error.message.includes("already registered")
                ? "This phone number is already registered. Please login instead."
                : error.message,
              variant: "destructive",
            });
          } else {
            // Update profile with phone number
            if (data.user) {
              await supabase
                .from("profiles")
                .update({ phone_number: phone })
                .eq("id", data.user.id);
            }
            
            toast({
              title: "Account created!",
              description: "You can now login with your phone number.",
            });
            setIsLogin(true);
          }
        } else {
          const { error, data } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              data: {
                full_name: fullName,
              },
            },
          });

          if (error) {
            if (error.message.includes("already registered")) {
              toast({
                title: "Account exists",
                description: "This email is already registered. Please login instead.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "Account created!",
              description: "You can now login with your credentials.",
            });
            setIsLogin(true);
          }
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Music2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Login to access your music distribution dashboard"
              : "Start distributing your music worldwide"}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  placeholder="+260 XXX XXX XXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  maxLength={13}
                />
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
