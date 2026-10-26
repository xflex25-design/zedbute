import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  ArrowUpRight,
  Download,
  Smartphone,
  CreditCard,
  X,
} from "lucide-react";

const PAYMENT_METHODS = [
  { value: "MTN_MOMO", label: "MTN Mobile Money", icon: Smartphone, color: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10" },
  { value: "AIRTEL_MONEY", label: "Airtel Money", icon: Smartphone, color: "text-red-300 border-red-500/30 bg-red-500/10" },
];

const DashboardRoyalties = () => {
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>("MTN_MOMO");
  const { toast } = useToast();
  const navigate = useNavigate();

  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const fetchData = async (userId: string) => {
    const [{ data: walletData }, { data: payoutsData }] = await Promise.all([
      supabase.from("artist_royalties").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("payout_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setWallet(walletData);
    setPayouts(payoutsData ?? []);
  };

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return;
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (profile?.full_name) setAccountName(profile.full_name);
        });
      fetchData(session.user.id).finally(() => {
        if (!ignore) setLoading(false);
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignore) return;
      if (session) {
        setUser(session.user);
        fetchData(session.user.id);
      }
    });
    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePhone = (phone: string) => {
    const zambiaPhoneRegex = /^(?:\+260|0)?(95|96|97|76|77)\d{7}$/;
    return zambiaPhoneRegex.test(phone);
  };

  const handlePayout = async () => {
    if (!user) return;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter an amount greater than 0.", variant: "destructive" });
      return;
    }
    if (wallet && parsedAmount > wallet.current_balance) {
      toast({ title: "Insufficient balance", description: "Amount exceeds your available balance.", variant: "destructive" });
      return;
    }
    if (!validatePhone(phoneNumber)) {
      toast({ title: "Invalid phone number", description: "Please enter a valid Zambian mobile money number.", variant: "destructive" });
      return;
    }
    if (!accountName.trim()) {
      toast({ title: "Account name required", description: "Please enter the name registered on your Mobile Money SIM.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("payout_requests").insert({
      user_id: user.id,
      amount: parsedAmount,
      payment_method: selectedMethod,
      phone_number: phoneNumber.trim(),
      account_name: accountName.trim(),
      status: "pending",
    });

    if (error) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payout requested", description: "Your withdrawal request has been submitted for review." });
      setShowPayoutForm(false);
      setAmount("");
      setPhoneNumber("");
      setAccountName("");
      setSelectedMethod("MTN_MOMO");
      if (user) fetchData(user.id);
    }
    setSubmitting(false);
  };

  const currentBalance = wallet?.current_balance ?? 0;
  const totalEarned = wallet?.total_earned ?? 0;
  const totalWithdrawn = wallet?.total_withdrawn ?? 0;

  const payoutStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center space-y-3">
          <Wallet className="h-10 w-10 animate-pulse text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ZedBute | Royalties & Payouts</title>
        <meta name="description" content="Manage your royalty earnings and request mobile money payouts." />
        <link rel="canonical" href="https://www.zedbute.com/dashboard/royalties" />
      </Helmet>

      <div className="min-h-screen bg-gradient-hero">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Royalties & Payouts</h1>
            <p className="text-muted-foreground">Track your earnings and request withdrawals to MTN MoMo or Airtel Money.</p>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="bg-[#0f0f1a]/80 border-white/10 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-xs text-gray-400 mb-1">Total Earned</p>
                <p className="text-2xl font-bold text-white">K{totalEarned.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f0f1a]/80 border-white/10 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-xs text-gray-400 mb-1">Total Withdrawn</p>
                <p className="text-2xl font-bold text-white">K{totalWithdrawn.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0f0f1a]/80 border-primary/30 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400">Available Balance</p>
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-bold text-white">K{currentBalance.toFixed(2)}</p>
                {currentBalance > 0 && (
                  <Button
                    onClick={() => setShowPayoutForm(true)}
                    className="mt-3 w-full h-10 bg-white text-black hover:bg-gray-100 font-semibold text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Request Payout
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payout Form Modal */}
          {showPayoutForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayoutForm(false)} />
              <div className="relative w-full max-w-lg bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-card p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Request Payout</h2>
                  <button onClick={() => setShowPayoutForm(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-200">Amount (K)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      max={currentBalance}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                    <p className="text-xs text-gray-500">Available: K{currentBalance.toFixed(2)}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-200">Payment Method</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setSelectedMethod(method.value)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                            selectedMethod === method.value
                              ? `${method.color}`
                              : "border-white/10 bg-white/5 text-gray-400"
                          }`}
                        >
                          <method.icon className="h-6 w-6" />
                          <span className="text-sm font-semibold">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-200">Mobile Money Phone Number</Label>
                    <Input
                      type="tel"
                      placeholder="097 123 4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-200">Registered Account Name</Label>
                    <Input
                      type="text"
                      placeholder="Name on Mobile Money SIM"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                    <p className="text-xs text-gray-500">Must match the name registered on your {selectedMethod === "MTN_MOMO" ? "MTN" : "Airtel"} account.</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handlePayout}
                      disabled={submitting}
                      className="flex-1 h-12 bg-white text-black hover:bg-gray-100 font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70"
                    >
                      {submitting ? (
                        <>
                          <Wallet className="h-4 w-4 mr-2 animate-pulse" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          Submit Request
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowPayoutForm(false)}
                      className="flex-1 h-12 border-white/20 text-gray-300 hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payout History */}
          <Card className="bg-[#0f0f1a]/80 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white">
                <Download className="h-5 w-5" />
                Payout History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="mx-auto h-10 w-10 text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">No payouts yet</p>
                  {currentBalance > 0 && (
                    <Button
                      onClick={() => setShowPayoutForm(true)}
                      className="mt-4 bg-white text-black hover:bg-gray-100 font-semibold"
                    >
                      Request Your First Payout
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-gray-400">Date</TableHead>
                      <TableHead className="text-gray-400">Method</TableHead>
                      <TableHead className="text-gray-400">Phone</TableHead>
                      <TableHead className="text-right text-gray-400">Amount</TableHead>
                      <TableHead className="text-right text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-sm text-gray-300">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm text-gray-300">
                          {p.payment_method === "MTN_MOMO" ? "MTN MoMo" : "Airtel Money"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-400">{p.phone_number}</TableCell>
                        <TableCell className="text-right font-medium text-white">K{parseFloat(p.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{payoutStatusBadge(p.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default DashboardRoyalties;
