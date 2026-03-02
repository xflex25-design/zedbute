import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";

const LENCO_PUBLIC_KEY = "YOUR_PUBLIC_KEY"; // Replace with your Lenco public key

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentType = searchParams.get("type") || "release";

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const paymentAmount = paymentType === "verification" ? 30 : 50;
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

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(profileData);
  };

  const savePaymentAndRedirect = async (transactionId: string, status: "verified" | "pending") => {
    const { error: dbError } = await supabase.from("release_payments").insert({
      user_id: user.id,
      amount: paymentAmount,
      payment_method: "lenco_inline",
      phone_number: "inline_checkout",
      transaction_id: transactionId,
      status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    });

    if (dbError) {
      console.error("Database error:", dbError);
    }

    toast({
      title: status === "verified" ? "Payment Successful!" : "Payment Submitted!",
      description: status === "verified"
        ? "Your payment has been processed. Redirecting..."
        : "Your payment will be verified shortly. Redirecting...",
    });

    if (paymentType === "verification") {
      sessionStorage.setItem("pendingVerificationPayment", "completed");
      navigate("/verify");
    } else {
      sessionStorage.setItem("pendingReleasePayment", "completed");
      navigate("/upload-release");
    }
  };

  const handlePayment = () => {
    if (typeof LencoPay === "undefined") {
      toast({
        title: "Error",
        description: "Payment system is loading. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const reference = `${paymentType}-${user.id}-${Date.now()}`;

    LencoPay.getPaid({
      key: LENCO_PUBLIC_KEY,
      reference,
      email: user.email,
      amount: paymentAmount,
      currency: "ZMW",
      channels: ["card", "mobile-money"],
      customer: {
        firstName: profile?.full_name?.split(" ")[0] || "Customer",
        lastName: profile?.full_name?.split(" ").slice(1).join(" ") || "",
        phone: profile?.phone_number || "",
      },
      onSuccess: async (response) => {
        await savePaymentAndRedirect(response.reference, "verified");
        setLoading(false);
      },
      onClose: () => {
        setLoading(false);
        toast({
          title: "Payment Cancelled",
          description: "You closed the payment window. No charge was made.",
        });
      },
      onConfirmationPending: () => {
        setLoading(false);
        savePaymentAndRedirect(reference, "pending");
      },
    });
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
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <h3 className="font-semibold mb-2 text-primary">Secure Checkout</h3>
                <p className="text-sm text-muted-foreground">
                  Pay securely via Mobile Money or Card. Click the button below to open the payment window.
                </p>
              </div>

              <Button
                onClick={handlePayment}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Pay K{paymentAmount}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Payment;
