import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Loader2, Zap } from "lucide-react";

const MERCHANT_NUMBER = "0974119780";

// Styled logo components
const AirtelMoneyLogo = ({ selected }: { selected: boolean }) => (
  <div className={`flex items-center justify-center p-4 rounded-lg transition-all cursor-pointer ${selected ? 'ring-2 ring-primary bg-red-500' : 'bg-red-500 hover:opacity-90'}`}>
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
      <div className="text-white">
        <div className="font-bold text-lg leading-tight">airtel</div>
        <div className="text-xs font-medium">money</div>
      </div>
    </div>
  </div>
);

const MTNMomoLogo = ({ selected }: { selected: boolean }) => (
  <div className={`flex items-center justify-center p-4 rounded-lg transition-all cursor-pointer ${selected ? 'ring-2 ring-primary bg-yellow-400' : 'bg-yellow-400 hover:opacity-90'}`}>
    <div className="flex items-center gap-2">
      <div className="font-bold text-blue-900 text-xl">MTN</div>
      <div className="flex flex-col items-center">
        <div className="text-blue-900 text-xs font-semibold">Mobile</div>
        <div className="text-blue-900 text-xs font-semibold">Money</div>
      </div>
    </div>
  </div>
);

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentType = searchParams.get("type") || "release"; // 'release' or 'verification'
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasValidPayment, setHasValidPayment] = useState(false);
  const [formData, setFormData] = useState({
    paymentMethod: "airtel",
    phoneNumber: "",
    transactionId: "",
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
    
    // Check if user already has valid payment for this year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const { data: payments } = await supabase
      .from("release_payments")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("status", "verified")
      .gte("created_at", startOfYear);
    
    if (payments && payments.length > 0) {
      setHasValidPayment(true);
    }
  };

  const isValidTransactionId = formData.transactionId.trim().length >= 6;

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

    if (!isValidTransactionId) {
      toast({
        title: "Error",
        description: "Please enter a valid transaction ID (at least 6 characters)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Auto-verify payment for instant real-time processing
      const { error } = await supabase.from("release_payments").insert({
        user_id: user.id,
        amount: paymentAmount,
        payment_method: formData.paymentMethod,
        phone_number: formData.phoneNumber,
        transaction_id: formData.transactionId.trim(),
        status: "verified", // Instant verification
        verified_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Payment Successful!",
        description: "Your payment has been processed instantly. Redirecting...",
      });

      // Navigate to appropriate page
      if (paymentType === "verification") {
        navigate("/verify");
      } else {
        navigate("/upload");
      }
    } catch (error: any) {
      console.error("Payment submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (hasValidPayment) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Card className="max-w-lg mx-auto shadow-card">
            <CardHeader className="text-center">
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">Payment Already Verified</CardTitle>
              <CardDescription>
                You have a valid payment for this year. You can proceed with {paymentLabel.toLowerCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => navigate(paymentType === "verification" ? "/verify" : "/upload")}
              >
                Continue to {paymentLabel}
              </Button>
            </CardContent>
          </Card>
        </div>
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
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold py-6 text-lg" 
                  disabled={loading || !isValidTransactionId || !formData.phoneNumber}
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

              {/* Verification Info */}
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <h3 className="font-semibold mb-2">Verify Your Payment</h3>
                <p className="text-sm text-muted-foreground">
                  After receiving a confirmation message from your mobile network, click the button below to verify your payment.
                </p>
              </div>

              {/* Transaction ID for verification */}
              <div className="space-y-2">
                <Label htmlFor="transactionId">Transaction ID (from SMS) <span className="text-destructive">*</span></Label>
                <Input
                  id="transactionId"
                  type="text"
                  placeholder="Enter transaction ID after payment"
                  value={formData.transactionId}
                  onChange={(e) =>
                    setFormData({ ...formData, transactionId: e.target.value })
                  }
                  required
                  className={formData.transactionId && !isValidTransactionId ? "border-destructive" : ""}
                />
                {formData.transactionId && !isValidTransactionId && (
                  <p className="text-sm text-destructive">Transaction ID must be at least 6 characters</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Payment;
