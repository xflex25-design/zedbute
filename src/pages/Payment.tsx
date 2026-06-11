import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Phone, Zap } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import type { User } from "@supabase/supabase-js";

declare global {
  interface Window {
    LencoPay?: {
      getPaid: (config: Record<string, any>) => void;
    };
  }
}

const LENCO_PUBLIC_KEY =
  import.meta.env.VITE_LENCO_PUBLIC_KEY ||
  "pub-6f90c9d7234ba5738a66ac8036942f6200ab2da1851e0e0c";

const PAYMENT_AMOUNT = 50;

interface Profile {
  id: string;
  full_name?: string;
  phone_number?: string;
}

export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paymentType = searchParams.get("type") || "release";
  const releaseId = searchParams.get("releaseId");

  const paymentLabel =
    paymentType === "verification"
      ? "Artist Verification"
      : "Release Upload";

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  const [initializing, setInitializing] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(data);

      if (data?.phone_number) {
        setPhoneNumber(data.phone_number);
      }
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "Failed to load account information.",
        variant: "destructive",
      });
    } finally {
      setInitializing(false);
    }
  }

  function validatePhone(phone: string) {
    const zambiaPhoneRegex = /^(?:\+260|0)?(95|96|97|76|77)\d{7}$/;
    return zambiaPhoneRegex.test(phone);
  }

  async function savePayment(
    transactionId: string,
    status: "verified" | "pending"
  ) {
    if (!user) return;

    const { error } = await supabase
      .from("release_payments")
      .insert({
        user_id: user.id,
        amount: PAYMENT_AMOUNT,
        payment_method: "lenco_inline",
        phone_number: phoneNumber,
        transaction_id: transactionId,
        status,
        verified_at:
          status === "verified"
            ? new Date().toISOString()
            : null,
      });

    if (error) throw error;
  }

  async function updateReleaseStatus() {
    if (!releaseId || !user) return;

    const { error } = await supabase
      .from("music_releases")
      .update({
        status: "pending",
      })
      .eq("id", releaseId)
      .eq("user_id", user.id)
      .eq("status", "unpaid");

    if (error) {
      console.error(error);
    }
  }

  async function handlePaymentSuccess(
    transactionId: string,
    status: "verified" | "pending"
  ) {
    try {
      await savePayment(transactionId, status);

      if (paymentType === "release") {
        await updateReleaseStatus();
      }

      toast({
        title:
          status === "verified"
            ? "Payment Successful"
            : "Payment Submitted",
        description:
          status === "verified"
            ? "Your release is pending review."
            : "Payment confirmation is pending.",
      });

      if (paymentType === "verification") {
        sessionStorage.setItem(
          "pendingVerificationPayment",
          "completed"
        );

        navigate("/verify");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);

      toast({
        title: "Error",
        description: "Failed to save payment information.",
        variant: "destructive",
      });
    }
  }

  function handlePayment() {
    if (processing) return;

    if (!user) return;

    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter your mobile money number.",
        variant: "destructive",
      });
      return;
    }

    if (!validatePhone(phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description:
          "Please enter a valid Zambian mobile number.",
        variant: "destructive",
      });
      return;
    }

    if (!window.LencoPay) {
      toast({
        title: "Payment System Not Ready",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    const reference = `${paymentType}-${crypto.randomUUID()}`;

    window.LencoPay.getPaid({
      key: LENCO_PUBLIC_KEY,
      reference,
      amount: PAYMENT_AMOUNT,
      currency: "ZMW",
      email: user.email,

      channels: ["card", "mobile-money"],

      customer: {
        firstName:
          profile?.full_name?.split(" ")[0] || "Customer",

        lastName:
          profile?.full_name?.split(" ").slice(1).join(" ") || "",

        phone: phoneNumber,
      },

      onSuccess: async (response: any) => {
        await handlePaymentSuccess(
          response.reference,
          "verified"
        );

        setProcessing(false);
      },

      onConfirmationPending: async () => {
        await handlePaymentSuccess(
          reference,
          "pending"
        );

        setProcessing(false);
      },

      onClose: () => {
        setProcessing(false);

        toast({
          title: "Payment Cancelled",
          description:
            "The payment window was closed.",
        });
      },
    });
  }

  if (initializing) {
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
              <CardTitle className="text-2xl">
                {paymentLabel} Payment
              </CardTitle>

              <CardDescription className="text-3xl font-bold mt-2">
                K{PAYMENT_AMOUNT}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>

                <Input
                  id="phone"
                  type="tel"
                  placeholder="0971234567"
                  value={phoneNumber}
                  onChange={(e) =>
                    setPhoneNumber(e.target.value)
                  }
                />

                <p className="text-xs text-muted-foreground">
                  Enter the number linked to your
                  mobile money account.
                </p>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <h3 className="font-semibold text-primary mb-2">
                  Secure Checkout
                </h3>

                <p className="text-sm text-muted-foreground">
                  Pay securely using Mobile Money
                  or Card.
                </p>
              </div>

              <Button
                className="w-full py-6 text-lg"
                disabled={processing}
                onClick={handlePayment}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Pay K{PAYMENT_AMOUNT}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}