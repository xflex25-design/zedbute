import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, LockKeyhole, Phone, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription";

export default function SubscriptionCheckout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan: SubscriptionPlan = params.get("plan") === "monthly" ? "monthly" : "annual";
  const amount = SUBSCRIPTION_PLANS[plan].amount;
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!/^(?:\+260|0)?(95|96|97|76|77)\d{7}$/.test(phone.trim())) {
      toast({ title: "Enter a valid Zambian number", description: "Use a number such as 097 123 4567.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("lenco-create-payment", {
      body: { plan, amount, phone_number: phone.trim(), currency: "ZMW", idempotency_key: crypto.randomUUID() },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Checkout is temporarily unavailable", description: "Please try again or contact support.", variant: "destructive" });
      return;
    }
    toast({ title: "Payment started", description: "Complete the mobile-money prompt on your phone." });
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 pt-28 sm:pt-32">
        <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Secure checkout</p><h1 className="mt-2 text-3xl font-bold">Complete your subscription</h1><p className="mt-2 text-muted-foreground">Pay securely with mobile money through Lenco.</p></div>
        <div className="grid gap-5 md:grid-cols-[1fr_0.8fr]">
          <Card><CardHeader><CardTitle>{plan === "annual" ? "Annual Plan" : "Monthly Plan"}</CardTitle><CardDescription>Billed every {plan === "annual" ? "365" : "30"} days</CardDescription></CardHeader><CardContent><div className="mb-6 flex items-end gap-2"><span className="text-5xl font-bold">K{amount}</span><span className="pb-2 text-muted-foreground">ZMW</span></div><ul className="flex flex-col gap-3 text-sm text-muted-foreground"><li className="flex gap-2"><CheckCircle2 className="size-4 text-primary" />Distribution to 100+ platforms</li><li className="flex gap-2"><CheckCircle2 className="size-4 text-primary" />Unlimited releases</li><li className="flex gap-2"><CheckCircle2 className="size-4 text-primary" />Keep 100% of your royalties</li></ul></CardContent></Card>
          <Card><CardHeader><CardTitle>Payment details</CardTitle><CardDescription>Your number receives the payment prompt.</CardDescription></CardHeader><CardContent><form className="flex flex-col gap-5" onSubmit={startPayment}><div className="flex flex-col gap-2"><Label htmlFor="phone">Mobile money number</Label><div className="relative"><Phone className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="phone" className="pl-9" placeholder="097 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} /></div></div><Button type="submit" variant="hero" disabled={submitting}>{submitting ? "Starting payment..." : `Pay K${amount}`}</Button><p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><LockKeyhole className="size-3" />Encrypted payment handoff</p></form></CardContent></Card>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Your subscription activates after Lenco confirms payment.</div>
      </main>
    </div>
  );
}
