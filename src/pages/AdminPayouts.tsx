import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Smartphone,
  Wallet,
  Coins,
} from "lucide-react";

type Payout = {
  id: string;
  user_id: string;
  amount: number;
  payment_method: "MTN_MOMO" | "AIRTEL_MONEY";
  phone_number: string;
  account_name: string;
  status: "pending" | "completed" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

const statusBadge = (status: string) => {
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

const AdminPayouts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  // Credit wallet form
  const [creditEmail, setCreditEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [crediting, setCrediting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = !!roles?.some((r: { role: string }) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await loadPayouts();
      else setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function loadPayouts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load payouts", description: error.message, variant: "destructive" });
    } else {
      setPayouts((data as unknown as Payout[]) ?? []);
    }
    setLoading(false);
  }

  const visible = payouts.filter((p) => (filter === "pending" ? p.status === "pending" : true));
  const pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  async function markPaid(p: Payout) {
    setProcessing(p.id);
    try {
      const { error } = await supabase.rpc("complete_payout_request", {
        p_payout_request_id: p.id,
      });
      if (error) throw error;
      toast({ title: "Marked as paid", description: `K${p.amount.toFixed(2)} sent to ${p.account_name}.` });
      await loadPayouts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Action failed", description: message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  }

  async function rejectPayout(p: Payout) {
    const reason = window.prompt("Reason for rejection (will be shown to the artist):");
    if (reason === null) return;
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please provide a rejection reason.", variant: "destructive" });
      return;
    }
    setProcessing(p.id);
    try {
      const { error } = await supabase.rpc("complete_payout_request", {
        p_payout_request_id: p.id,
        p_rejection_reason: reason.trim(),
      });
      if (error) throw error;
      toast({ title: "Payout rejected", description: `${p.account_name}'s request was rejected.` });
      await loadPayouts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Action failed", description: message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  }

  async function creditWallet() {
    const parsed = parseFloat(creditAmount);
    if (!creditEmail.trim() || !parsed || parsed <= 0) {
      toast({ title: "Invalid input", description: "Enter the artist's email and an amount greater than 0.", variant: "destructive" });
      return;
    }
    setCrediting(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", creditEmail.trim().toLowerCase())
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        toast({ title: "Artist not found", description: "No user with that email.", variant: "destructive" });
        return;
      }
      const { error } = await supabase.rpc("admin_credit_wallet", {
        p_user_id: profile.id,
        p_amount: parsed,
      });
      if (error) throw error;
      toast({
        title: "Wallet credited",
        description: `Added K${parsed.toFixed(2)} to ${profile.full_name ?? creditEmail}.`,
      });
      setCreditEmail("");
      setCreditAmount("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Credit failed", description: message, variant: "destructive" });
    } finally {
      setCrediting(false);
    }
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar />
        <div className="container mx-auto pt-24 max-w-md">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">Admins only</h2>
              <p className="text-sm text-muted-foreground">You don't have access to this page.</p>
              <Button onClick={() => navigate("/dashboard")}>Back</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ZedBute | Admin — Payouts</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-hero">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Admin — Payouts</h1>
              <p className="text-sm text-muted-foreground">
                Review withdrawal requests and credit artist royalty wallets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("pending")}
              >
                Pending
              </Button>
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
            </div>
          </div>

          {/* Summary + credit wallet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="bg-[#0f0f1a]/80 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Wallet className="h-5 w-5 text-primary" />
                  Pending Payouts
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {payouts.filter((p) => p.status === "pending").length} awaiting payment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">K{pendingTotal.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0f0f1a]/80 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Coins className="h-5 w-5 text-primary" />
                  Credit Artist Wallet
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Load earned royalties into an artist's balance (ZMK)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="artist@email.com"
                    value={creditEmail}
                    onChange={(e) => setCreditEmail(e.target.value)}
                    className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount (K)"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                  />
                </div>
                <Button
                  onClick={creditWallet}
                  disabled={crediting}
                  className="w-full h-10 bg-white text-black hover:bg-gray-100 font-semibold"
                >
                  {crediting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Coins className="h-4 w-4 mr-2" />}
                  Credit Wallet
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Payout list */}
          {loading ? (
            <p className="text-center text-muted-foreground py-10">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </p>
          ) : visible.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No payout requests here.</p>
          ) : (
            <div className="space-y-4">
              {visible.map((p) => (
                <Card key={p.id} className="bg-[#0f0f1a]/80 border-white/10 shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base text-white">
                          {p.account_name}
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          {p.profiles?.email ?? "Unknown email"} ·{" "}
                          {new Date(p.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                      {statusBadge(p.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Amount</p>
                        <p className="font-semibold text-white">K{p.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Method</p>
                        <p className="text-white flex items-center gap-1">
                          <Smartphone className="h-4 w-4" />
                          {p.payment_method === "MTN_MOMO" ? "MTN MoMo" : "Airtel Money"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Phone</p>
                        <p className="text-white">{p.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">SIM Name</p>
                        <p className="text-white">{p.account_name}</p>
                      </div>
                    </div>

                    {p.rejection_reason && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                        Reason: {p.rejection_reason}
                      </p>
                    )}

                    {p.status === "pending" && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <Button
                          onClick={() => markPaid(p)}
                          disabled={processing === p.id}
                          className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {processing === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as Paid
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => rejectPayout(p)}
                          disabled={processing === p.id}
                          className="flex-1 h-10 border-red-500/30 text-red-300 hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminPayouts;
