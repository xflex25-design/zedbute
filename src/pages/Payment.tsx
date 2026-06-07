import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap, Phone } from "lucide-react";
import { promise } from "zod";

const LENCO_PUBLIC_KEY = "pub-6f90c9d7234ba5738a66ac8036942f6200ab2da1851e0e0c";

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentType = searchParams.get("type") || "release";
  const releaseId = searchParams.get("releaseId");

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  const paymentAmount = 50;
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
    if (profileData?.phone_number) {
      setPhoneNumber(profileData.phone_number);
    }
  };

  const savePaymentAndRedirect = async (transactionId: string, status: "verified" | "pending") => {
    const { error: dbError } = await supabase.from("release_payments").insert({
      user_id: user.id,
      amount: paymentAmount,
      payment_method: "lenco_inline",
      phone_number: phoneNumber,
      transaction_id: transactionId,
      status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    });

    if (dbError) {
      console.error("Database error:", dbError);
    }

    // For release payments, flip the saved release from 'unpaid' to 'pending'
    if (paymentType === "release" && releaseId) {
      const { error: releaseErr } = await supabase
        .from("music_releases")
        .update({ status: "pending" })
        .eq("id", releaseId)
        .eq("user_id", user.id);
      if (releaseErr) {
        console.error("Failed to update release status:", releaseErr);
        toast({
          title: "Release status update failed",
          description: "Payment recorded, but we couldn't mark your release as pending. Contact support.",
          variant: "destructive",
        });
      }
    }

    toast({
      title: status === "verified" ? "Payment Successful!" : "Payment Submitted!",
      description: status === "verified"
        ? "Your release is now pending review. Redirecting..."
        : "Your payment will be verified shortly. Redirecting...",
    });

    if (paymentType === "verification") {
      sessionStorage.setItem("pendingVerificationPayment", "completed");
      navigate("/verify");
    } else {
      navigate("/dashboard");
    }
  };

  const handlePayment = () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number before proceeding.",
        variant: "destructive",
      });
      return;
    }

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
        phone: phoneNumber,
      },
      onSuccess: async (response) => {
        await savePaymentAndRedirect(response.reference, "verified");
        await new Promise(res=>setTimeout(res,300));
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
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g. 0971234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the phone number associated with your mobile money account.
                </p>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <h3 className="font-semibold mb-2 text-primary">Secure Checkout</h3>
                <p className="text-sm text-muted-foreground">
                  Pay securely via Mobile Money or Card. Click the button below to open the payment window.
                </p>
              </div>

              <Button
                onClick={handlePayment}
                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-6 text-lg"
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
