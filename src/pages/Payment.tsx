import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";

const AIRTEL_NUMBER = "0974119780";
const MTN_NUMBER = "0979580446";

type MomoErrorPayload = {
  error?: string;
  code?: string;
  userMessage?: string;
  providerMessage?: string;
  details?: string;
};

function getMomoFriendlyMessage(opts: {
  functionError?: any;
  payload?: any;
}): string {
  const { functionError, payload } = opts;

  // If the function returned structured error info
  const p = (payload ?? {}) as MomoErrorPayload;
  if (p.userMessage) return p.userMessage;

  // If invoke returned a non-2xx, Supabase provides a generic message.
  const status = functionError?.context?.status ?? functionError?.status;
  const msg = String(functionError?.message ?? "");

  if (status === 429) return "Too many payment attempts. Please wait a moment and try again.";
  if (status === 401 || /unauthorized|access denied/i.test(msg)) {
    return "Payment service authentication failed. Please try again later.";
  }
  if (status === 400) {
    return "Payment request was rejected. Check your phone number and try again.";
  }
  if (status >= 500) {
    return "Payment service is temporarily unavailable. Please try again shortly.";
  }

  return msg || "Failed to process payment. Please try again.";
}

// Styled round logo components
const AirtelMoneyLogo = ({ selected }: { selected: boolean }) => (
  <div className="flex flex-col items-center gap-2 cursor-pointer">
    <div className={`w-20 h-20 rounded-full bg-red-500 flex flex-col items-center justify-center transition-all ${selected ? 'ring-4 ring-primary ring-offset-2' : 'hover:scale-105'}`}>
      <div className="text-white font-bold text-sm leading-tight">airtel</div>
      <div className="text-white text-[10px] font-medium">money</div>
    </div>
    <span className="text-sm text-muted-foreground">Airtel Money</span>
  </div>
);

const MTNMomoLogo = ({ selected }: { selected: boolean }) => (
  <div className="flex flex-col items-center gap-2 cursor-pointer">
    <div className={`w-20 h-20 rounded-full bg-yellow-400 flex flex-col items-center justify-center transition-all ${selected ? 'ring-4 ring-primary ring-offset-2' : 'hover:scale-105'}`}>
      <div className="font-bold text-blue-900 text-sm">MTN</div>
      <div className="text-blue-900 text-[8px] font-semibold">Mobile Money</div>
    </div>
    <span className="text-sm text-muted-foreground">MTN MoMo</span>
  </div>
);

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentType = searchParams.get("type") || "release"; // 'release' or 'verification'
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    paymentMethod: "mtn",
    phoneNumber: "",
  });

  const paymentAmount = paymentType === "verification" ? 30 : 399;
  const paymentLabel = paymentType === "verification" ? "Artist Verification" : "Release Upload";

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    // Don't check for existing payments - each submission requires new payment
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phoneNumber) {
      toast({
        title: "Error",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    // Route to appropriate payment function
    const isAirtel = formData.paymentMethod === "airtel";

    setLoading(true);

    try {
      toast({
        title: "Payment Request Sent",
        description: "Please check your phone for the PIN prompt to authorize payment.",
      });

      const functionName = isAirtel ? 'airtel-money-payment' : 'mtn-momo-payment';
      const requestBody = isAirtel
        ? {
            amount: paymentAmount,
            phoneNumber: formData.phoneNumber,
            reference: `${paymentType}-${user.id}-${Date.now()}`,
            payerMessage: `Payment for ${paymentLabel}`,
          }
        : {
            amount: paymentAmount,
            phoneNumber: formData.phoneNumber,
            externalId: `${paymentType}-${user.id}-${Date.now()}`,
            payerMessage: `Payment for ${paymentLabel}`,
            payeeNote: `${paymentLabel} - K${paymentAmount}`,
          };

      // Call payment API via backend function
      const { data, error: functionError } = await supabase.functions.invoke(functionName, {
        body: requestBody,
      });

      if (functionError) {
        // Some function errors include a parsed JSON body under `context`.
        // If we can't access it, we still show a friendly message.
        throw Object.assign(new Error(getMomoFriendlyMessage({ functionError, payload: data })), {
          raw: functionError,
          payload: data,
        });
      }

      console.log('Payment response:', data);

      if (data.success) {
        // Payment successful - save to database
        const { error: dbError } = await supabase.from("release_payments").insert({
          user_id: user.id,
          amount: paymentAmount,
          payment_method: formData.paymentMethod,
          phone_number: formData.phoneNumber,
          transaction_id: data.referenceId,
          status: "verified",
          verified_at: new Date().toISOString(),
        });

        if (dbError) {
          console.error('Database error:', dbError);
        }

        toast({
          title: "Payment Successful!",
          description: "Your payment has been processed. Redirecting...",
        });

        // Redirect based on payment type
        if (paymentType === "verification") {
          sessionStorage.setItem("pendingVerificationPayment", "completed");
          navigate("/verify");
        } else {
          sessionStorage.setItem("pendingReleasePayment", "completed");
          navigate("/upload-release");
        }
      } else if (data.status === 'PENDING') {
        toast({
          title: "Payment Pending",
          description: data.message || "Please enter your PIN on your phone to complete payment.",
          variant: "destructive",
        });
      } else {
        throw new Error(data.error || data.reason || 'Payment failed');
      }
    } catch (error: any) {
      console.error("Payment error:", error?.raw ?? error);

      const description =
        error?.payload?.userMessage ||
        error?.message ||
        "Failed to process payment. Please try again.";

      toast({
        title: "Payment Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-lg mx-auto">
          <Card className="shadow-card">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{paymentLabel} Payment</CardTitle>
              <CardDescription className="text-3xl font-bold text-foreground mt-2">
                K{paymentAmount}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Methods - Logo Style */}
              <div className="space-y-3">
                <Label className="text-center block font-semibold">We Currently Accept:</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div onClick={() => setFormData({ ...formData, paymentMethod: "airtel" })}>
                    <AirtelMoneyLogo selected={formData.paymentMethod === "airtel"} />
                  </div>
                  <div onClick={() => setFormData({ ...formData, paymentMethod: "mtn" })}>
                    <MTNMomoLogo selected={formData.paymentMethod === "mtn"} />
                  </div>
                </div>
              </div>

              {/* Payment Info Section */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              {formData.paymentMethod === "mtn" ? (
                  <>
                    <h3 className="font-semibold mb-2 text-primary">MTN MoMo - Automatic Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your phone number and click "Make Payment". You'll receive a PIN prompt on your phone to authorize the K{paymentAmount} payment.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold mb-2 text-primary">Airtel Money - Automatic Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your Airtel number and click "Make Payment". You'll receive a prompt on your phone to authorize the K{paymentAmount} payment.
                    </p>
                  </>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Phone Number with +260 prefix */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <div className="flex">
                    <div className="flex items-center px-3 bg-muted border border-r-0 border-input rounded-l-md text-muted-foreground">
                      +260
                    </div>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="Enter phone number"
                      value={formData.phoneNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, phoneNumber: e.target.value })
                      }
                      className="rounded-l-none"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg" 
                  disabled={loading || !formData.phoneNumber}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Make Payment
                    </>
                  )}
                </Button>
              </form>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Payment;
