import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Loader as Loader2,
  Phone,
  Zap,
  Lock,
  Smartphone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import type { User } from "@supabase/supabase-js";
import emailjs from "@emailjs/browser";

const PESAPAL_CONSUMER_KEY = import.meta.env.VITE_PESAPAL_CONSUMER_KEY || "4KELk9gVxyKMnj2rrzY9P8Z9Dyu8ysiY";
const PESAPAL_CONSUMER_SECRET = import.meta.env.VITE_PESAPAL_CONSUMER_SECRET || "DWUbYGRnyNM4h0jU3bXs5dk20qk=";

interface Profile {
  id: string;
  full_name?: string;
  phone_number?: string;
}

type PaymentStep = "details" | "method" | "processing" | "success" | "failed";

const paymentMethodLabels: Record<string, string> = {
  verification: "Artist Verification",
  "boomplay-claim": "Boomplay Claim",
  "spotify-claim": "Spotify Claim",
  "playlist-submission": "Playlist Submission",
  promotion: "Promote Release",
  ep: "EP Upload",
  album: "Album Upload",
  release: "Single Upload",
};

const defaultAmounts: Record<string, number> = {
  "boomplay-claim": 40,
  "spotify-claim": 40,
  promotion: 20,
  ep: 200,
  album: 500,
  release: 50,
  verification: 260,
};

const ZMK_TO_USD_RATE = 25;

const formatZmkWithUsd = (zmk: number) => {
  const usd = zmk / ZMK_TO_USD_RATE;
  return `K${zmk.toFixed(2)} ($${usd.toFixed(2)} USD)`;
};

export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paymentType = searchParams.get("type") || "release";
  const releaseId = searchParams.get("releaseId");
  const promotionId = searchParams.get("promotionId");
  const claimId = searchParams.get("claimId");
  const batchId = searchParams.get("batchId");
  const verificationId = searchParams.get("verificationId");
  const amountParam = searchParams.get("amount");
  const returnUrl = searchParams.get("returnUrl");

  const paymentLabel =
    paymentMethodLabels[paymentType] || "Single Upload";

  const defaultAmount = defaultAmounts[paymentType] || 50;
  const paymentAmount = amountParam ? parseInt(amountParam, 10) : defaultAmount;
  const paymentAmountUsd = paymentAmount / ZMK_TO_USD_RATE;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  const [initializing, setInitializing] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<PaymentStep>("details");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentHandled = useRef(false);

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
        amount: paymentAmount,
        payment_method: "pesapal_redirect",
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
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to update release status to pending:", error);
      throw error;
    }
  }

  async function savePromotionPayment(transactionId: string, status: "verified" | "pending") {
    if (!user || !promotionId) return;
    const { error } = await supabase.from("promotion_payments").insert({
      promotion_id: promotionId,
      user_id: user.id,
      amount: 20,
      payment_method: "pesapal_redirect",
      transaction_id: transactionId,
      status,
      payment_proof: null,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    });
    if (error) throw error;
    if (status === "verified") {
      await supabase.from("promotions").update({ status: "active", start_date: new Date().toISOString().split("T")[0], end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] }).eq("id", promotionId);
    }
  }

  async function handlePaymentSuccess(
    transactionId: string,
    status: "verified" | "pending"
  ): Promise<string | null> {
    try {
      if (paymentType === "promotion") {
        await savePromotionPayment(transactionId, status);
        toast({
          title: status === "verified" ? "Promotion Activated!" : "Promotion Payment Submitted",
          description: status === "verified" ? "Your release will be featured for 7 days." : "Your promotion will be activated once payment is confirmed.",
        });
        return returnUrl || "/dashboard";
      }

      await savePayment(transactionId, status);

      if (paymentType === "release" || paymentType === "ep" || paymentType === "album") {
        await updateReleaseStatus();
      }

      sessionStorage.removeItem("pendingReleasePayment");
      sessionStorage.removeItem("pendingCoverArtName");
      sessionStorage.removeItem("pendingAudioFileName");

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

      if ((paymentType === "release" || paymentType === "ep" || paymentType === "album") && status === "verified") {
        try {
          const { data: release } = await supabase
            .from("music_releases")
            .select("title")
            .eq("id", releaseId)
            .single();

          if (release && user?.email) {
            emailjs.send(
              "service_m5ipkn6",
              "template_h6m0hkf",
              {
                to_email: user.email,
                title: "Your release has been submitted!",
                message: `Hi,\n\nYour release "${release.title}" has been successfully submitted. It will be reviewed and distributed within 2 weeks.\n\nThank you for using ZedBute.`,
              },
              "y6dBkyYNeiQ5-ONrT"
            );
          }
        } catch (e) {
          console.error("Upload confirmation email failed:", e);
        }
      }

      if (paymentType === "verification") {
        sessionStorage.setItem(
          "pendingVerificationPayment",
          "completed"
        );

        if (verificationId) {
          await supabase
            .from("artist_verifications")
            .update({ payment_status: "paid", payment_transaction_id: transactionId })
            .eq("id", verificationId);
        }

        return returnUrl || "/verify";
      } else if (
        paymentType === "boomplay-claim" ||
        paymentType === "spotify-claim"
      ) {
        await savePayment(transactionId, status);

        const claimId = searchParams.get("claimId");
        if (claimId && user) {
          const isSpotify = paymentType === "spotify-claim";
          const table = isSpotify ? "spotify_claims" : "boomplay_claims";
          const linkCol = isSpotify ? "spotify_link" : "boomplay_link";
          const fnName = isSpotify
            ? "send-spotify-claim-instructions"
            : "send-boomplay-claim-instructions";
          const paymentStatus: "paid" | "pending" =
            status === "verified" ? "paid" : "pending";

          const { data: claimRow, error: claimErr } = await (supabase as any)
            .from(table)
            .select(`id, name, email, ${linkCol}`)
            .eq("id", claimId)
            .eq("user_id", user.id)
            .single();

          if (!claimErr && claimRow) {
            await (supabase as any)
              .from(table)
              .update({ payment_status: paymentStatus })
              .eq("id", claimId);

            const { error: fnError } = await supabase.functions.invoke(fnName, {
              body: {
                to_email: claimRow.email,
                to_name: claimRow.name,
                spotify_link: isSpotify ? claimRow.spotify_link : null,
                boomplay_link: isSpotify ? null : claimRow.boomplay_link,
              },
            });

            if (!fnError) {
              await (supabase as any)
                .from(table)
                .update({ claim_status: "Instructions Sent" })
                .eq("id", claimId);
            }
          }
        }

        return (
          returnUrl ||
          (paymentType === "spotify-claim" ? "/spotify-claim" : "/boomplay-claim")
        );
      } else if (paymentType === "playlist-submission") {
        const batchId = searchParams.get("batchId");
        if (batchId && user) {
          const paymentStatus: "paid" | "pending" =
            status === "verified" ? "paid" : "pending";

          const { error: updErr } = await (supabase as any)
            .from("playlist_submissions")
            .update({ payment_status: paymentStatus })
            .eq("payment_batch_id", batchId);

          if (!updErr) {
            await supabase.functions.invoke("notify-playlist-submission", {
              body: { batchId },
            });
          }
        }

        return returnUrl || "/playlists?paid=1";
      } else if (paymentType === "promotion") {
        return returnUrl || "/dashboard";
      } else {
        return returnUrl || "/release-success";
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to save payment information.",
        variant: "destructive",
      });
      return null;
    }
  }

  function initiatePayment() {
    if (processing) return;

    paymentHandled.current = false;

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

    setStep("processing");
    setPaymentError(null);
    setProcessing(true);

    const reference = `${paymentType}-${crypto.randomUUID()}`;

    try {
      const { data, error } = await supabase.functions.invoke('pesapal-create-order', {
        body: {
          amount: paymentAmount,
          currency: 'ZMW',
          reference,
          description: paymentLabel,
          callback_url: returnUrl || `${window.location.origin}/api/pesapal/callback`,
          redirect_url: returnUrl || `${window.location.origin}/payment-return`,
          customer: {
            firstName: profile?.full_name?.split(' ')[0] || 'Customer',
            lastName: profile?.full_name?.split(' ').slice(1).join(' ') || '',
            email: user.email || '',
            phone: phoneNumber,
          },
        },
      });

      if (error) {
        throw error;
      }

      const redirectUrl = (data as any)?.redirectUrl || (data as any)?.raw?.redirect_url;
      if (!redirectUrl) {
        throw new Error('No redirect URL returned from payment provider');
      }

      // redirect user to Pesapal checkout
      window.location.href = redirectUrl;
    } catch (err: any) {
      console.error('Payment initiation failed', err);
      toast({ title: 'Payment Error', description: err?.message || 'Failed to initiate payment', variant: 'destructive' });
      setProcessing(false);
      setStep('failed');
      setPaymentError(err?.message || 'Failed to initiate payment');
    }
  }

  function retryPayment() {
    setStep("details");
    setPaymentError(null);
  }

  function goTo(url: string) {
    if (/^https?:\/\//i.test(url)) {
      window.location.href = url;
    } else {
      navigate(url);
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing secure checkout...</p>
        </div>
      </div>
    );
  }

  const isSuccess = step === "success";
  const isFailed = step === "failed";
  const isProcessing = step === "processing";

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />

      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12">
        <div className="max-w-sm sm:max-w-lg mx-auto">
          {!isSuccess && !isFailed && (
            <>
              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {["details", "method", "processing"].map((s, idx) => {
                  const stepNum = idx + 1;
                  const isActive = step === s;
                  const isPast = ["details", "method", "processing"].indexOf(step) > idx;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      {idx > 0 && (
                        <div className={`h-px w-6 sm:w-8 ${isPast ? "bg-primary" : "bg-white/10"}`} />
                      )}
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-glow"
                              : isPast
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-white/5 text-gray-500 border border-white/10"
                          }`}
                        >
                          {isPast ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
                        </div>
                        <span className={`text-xs font-medium hidden sm:inline ${isActive ? "text-white" : "text-gray-500"}`}>
                          {s === "details" ? "Details" : s === "method" ? "Method" : "Processing"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div
            className={`rounded-2xl border shadow-card transition-all duration-500 ${
              isSuccess
                ? "border-green-500/30 bg-[#0f0f1a]/90 backdrop-blur-md"
                : isFailed
                  ? "border-red-500/30 bg-[#0f0f1a]/90 backdrop-blur-md"
                  : "border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm"
            }`}
          >
            {isSuccess ? (
              /* SUCCESS STATE */
              <div className="p-8 sm:p-10 text-center space-y-5">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-2 animate-pulse">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Payment Successful!</h2>
                      <p className="text-gray-400 text-sm sm:text-base">
                        Your <span className="text-white font-semibold">{paymentLabel}</span> payment of <span className="text-white font-semibold">{formatZmkWithUsd(paymentAmount)}</span> has been confirmed.
                      </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-left space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <ShieldCheck className="h-4 w-4 text-green-400" />
                    <span>Transaction secured with 256-bit encryption</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Reference: <span className="text-gray-400 font-mono">{paymentType}-{crypto.randomUUID().slice(0, 8)}</span>
                  </p>
                </div>
                <Button
                  className="w-full h-12 bg-white text-black hover:bg-gray-100 font-semibold"
                  onClick={() => goTo(returnUrl || "/dashboard")}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : isFailed ? (
              /* FAILED STATE */
              <div className="p-8 sm:p-10 text-center space-y-5">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-2">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Payment Cancelled</h2>
                  <p className="text-gray-400 text-sm sm:text-base">
                    {paymentError || "Something went wrong with your payment."}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 h-12 bg-white text-black hover:bg-gray-100 font-semibold"
                    onClick={retryPayment}
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border-white/20 text-gray-300 hover:bg-white/10"
                    onClick={() => navigate("/contact")}
                  >
                    Contact Support
                  </Button>
                </div>
              </div>
            ) : isProcessing ? (
              /* PROCESSING STATE */
              <div className="p-8 sm:p-10 text-center space-y-5">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Processing Payment</h2>
                  <p className="text-gray-400 text-sm sm:text-base">
                    Securing connection and authorizing transaction...
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-sm text-gray-300">Connecting to payment gateway...</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-white/10" />
                    <span className="text-sm text-gray-500">Waiting for confirmation...</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Please do not close this window. Check your phone for the Mobile Money PIN prompt.
                </p>
              </div>
            ) : (
              /* MAIN PAYMENT FORM */
              <>
                <div className="p-6 sm:p-8">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">
                      {paymentLabel} Payment
                    </h1>
                    <p className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">
                      {formatZmkWithUsd(paymentAmount)}
                    </p>
                  </div>

                  {/* Trust Badges */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-yellow-500/15 text-yellow-300 border border-yellow-500/25 rounded-full px-3 py-1.5 font-semibold">
                      <Smartphone className="h-3.5 w-3.5" /> MTN MoMo
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-yellow-400/15 text-yellow-200 border border-yellow-400/25 rounded-full px-3 py-1.5 font-semibold">
                      <Smartphone className="h-3.5 w-3.5" /> Airtel Money
                    </span>
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-center justify-center gap-2 mb-6 text-xs text-gray-500">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Secured & Encrypted Local Payments</span>
                  </div>

                  {/* Mobile Money Form */}
                  <div className="space-y-2 mb-6">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium text-gray-200">
                      <Phone className="h-4 w-4 text-gray-400" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="097 123 4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-primary/50 focus:ring-primary/20"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the number linked to your mobile money account.
                    </p>
                  </div>

                  {/* CTA Button */}
                  <Button
                    className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    size="lg"
                    disabled={processing}
                    onClick={initiatePayment}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Securing connection...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" />
                        Pay {formatZmkWithUsd(paymentAmount)}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Bottom Trust Line */}
          {!isSuccess && !isFailed && (
            <div className="mt-6 text-center space-y-2">
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500/60" />
                  SSL Encrypted
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-primary/60" />
                  Secure Checkout
                </span>
              </div>
                <p className="text-xs text-gray-600">
                Powered by{" "}
                  <span className="text-gray-500 font-medium">
                  Pesapal
                </span>
                · Trusted by 10,000+ businesses
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}