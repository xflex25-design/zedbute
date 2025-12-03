import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Smartphone, CheckCircle, Copy, Loader2 } from "lucide-react";

const MERCHANT_NUMBER = "0974119780";

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentType = searchParams.get("type") || "release"; // 'release' or 'verification'
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(MERCHANT_NUMBER);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Phone number copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phoneNumber || !formData.transactionId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("release_payments").insert({
        user_id: user.id,
        amount: paymentAmount,
        payment_method: formData.paymentMethod,
        phone_number: formData.phoneNumber,
        transaction_id: formData.transactionId,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Payment Submitted",
        description: "Your payment is pending verification. You'll be notified once confirmed.",
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
              <CardTitle className="text-2xl">Payment for {paymentLabel}</CardTitle>
              <CardDescription>
                Pay K{paymentAmount} via mobile money to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Instructions */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Payment Instructions
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Open your Airtel Money or MTN Mobile Money app</li>
                  <li>Select "Send Money" or "Transfer"</li>
                  <li>
                    Enter this number:{" "}
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="inline-flex items-center gap-1 font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border hover:bg-accent transition-colors"
                    >
                      {MERCHANT_NUMBER}
                      {copied ? (
                        <CheckCircle className="h-3 w-3 text-primary" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </li>
                  <li>Enter amount: <span className="font-bold text-foreground">K{paymentAmount}</span></li>
                  <li>Complete the transaction and note your Transaction ID</li>
                  <li>Enter the details below to confirm your payment</li>
                </ol>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMethod: value })
                    }
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                      <RadioGroupItem value="airtel" id="airtel" />
                      <Label htmlFor="airtel" className="cursor-pointer flex-1">
                        Airtel Money
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors">
                      <RadioGroupItem value="mtn" id="mtn" />
                      <Label htmlFor="mtn" className="cursor-pointer flex-1">
                        MTN MoMo
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Your Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="097XXXXXXX"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, phoneNumber: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The phone number you used to make the payment
                  </p>
                </div>

                {/* Transaction ID */}
                <div className="space-y-2">
                  <Label htmlFor="transactionId">Transaction ID *</Label>
                  <Input
                    id="transactionId"
                    type="text"
                    placeholder="Enter transaction ID from SMS"
                    value={formData.transactionId}
                    onChange={(e) =>
                      setFormData({ ...formData, transactionId: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The reference number from your mobile money confirmation SMS
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    `Submit Payment Confirmation`
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Your payment will be verified within 24 hours. You'll receive a
                notification once confirmed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Payment;
