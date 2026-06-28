import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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
  Filter,
} from "lucide-react";

const Royalties = () => {
  const [user, setUser] = useState<any>(null);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawCode, setWithdrawCode] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const { toast } = useToast();

  const fetchData = async (userId: string) => {
    const [{ data: royaltiesData }, { data: withdrawalsData }] = await Promise.all([
      supabase
        .from("royalty_records")
        .select("*")
        .eq("user_id", userId)
        .order("date_earned", { ascending: false }),
      supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false }),
    ]);
    setRoyalties(royaltiesData ?? []);
    setWithdrawals(withdrawalsData ?? []);
  };

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return;
      if (session) {
        setUser(session.user);
        fetchData(session.user.id).finally(() => {
          if (!ignore) setLoading(false);
        });
      } else {
        setLoading(false);
      }
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
  }, []);

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    setSubmittingWithdraw(true);
    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: user.id,
      amount: parseFloat(withdrawAmount),
      bank_name: withdrawBank,
      bank_account_number: withdrawAccount,
      bank_code: withdrawCode,
      status: "pending",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Withdrawal requested", description: "Your request has been submitted for processing." });
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setWithdrawBank("");
      setWithdrawAccount("");
      setWithdrawCode("");
      if (user) fetchData(user.id);
    }
    setSubmittingWithdraw(false);
  };

  const totalCleared = royalties
    .filter((r) => r.status === "cleared")
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const totalPaid = withdrawals
    .filter((w) => w.status === "paid" || w.status === "approved")
    .reduce((sum, w) => sum + (w.amount || 0), 0);

  const available = Math.max(0, totalCleared - totalPaid);

  const filteredRoyalties = statusFilter === "all"
    ? royalties
    : royalties.filter((r) => r.status === statusFilter);

  const royaltyStatusBadge = (status: string) => {
    switch (status) {
      case "cleared":
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Cleared</Badge>;
      case "paid":
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case "disputed":
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Disputed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const withdrawalStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Paid</Badge>;
      case "approved":
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Helmet>
        <title>ZedBute | Royalties</title>
        <meta name="description" content="View your royalty earnings and manage withdrawals." />
        <link rel="canonical" href="https://www.zedbute.com/" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-6xl">

          <h1 className="text-3xl font-bold mb-6">Royalties</h1>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-card border border-border rounded-2xl">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">Total Cleared</p>
                <p className="text-2xl font-bold">${totalCleared.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-border rounded-2xl">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">Total Paid Out</p>
                <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border border-border rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">Available Balance</p>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className={`text-2xl font-bold ${available >= 100 ? "text-green-600" : "text-foreground"}`}>
                  ${available.toFixed(2)}
                </p>
                {available >= 100 ? (
                  <Button
                    onClick={() => setShowWithdrawForm(true)}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm font-semibold hover:opacity-90"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Request Withdrawal
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">Minimum withdrawal: <strong>$100.00</strong></p>
                )}
              </CardContent>
            </Card>
          </div>

{/* Withdrawal Form */}
           {showWithdrawForm && (
             <Card className="bg-card border border-border rounded-2xl mb-6 sm:mb-8">
               <CardContent className="p-4 sm:p-6">
                 <h2 className="text-lg font-semibold mb-3 sm:mb-4">Request Withdrawal</h2>
                 <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4">
                   <div>
                     <Label htmlFor="withdrawAmount" className="text-sm">Amount (USD)</Label>
                     <Input
                       id="withdrawAmount"
                       type="number"
                       placeholder="100.00"
                       value={withdrawAmount}
                       onChange={(e) => setWithdrawAmount(e.target.value)}
                       min="100"
                       step="0.01"
                       className="h-10 mt-1"
                     />
                   </div>
                   <div>
                     <Label htmlFor="withdrawBank" className="text-sm">Bank Name</Label>
                     <Input
                       id="withdrawBank"
                       placeholder="e.g., Zanaco"
                       value={withdrawBank}
                       onChange={(e) => setWithdrawBank(e.target.value)}
                       className="h-10 mt-1"
                     />
                   </div>
                   <div>
                     <Label htmlFor="withdrawAccount" className="text-sm">Account Number</Label>
                     <Input
                       id="withdrawAccount"
                       placeholder="Account number"
                       value={withdrawAccount}
                       onChange={(e) => setWithdrawAccount(e.target.value)}
                       className="h-10 mt-1"
                     />
                   </div>
                   <div>
                     <Label htmlFor="withdrawCode" className="text-sm">Bank Code / SWIFT</Label>
                     <Input
                       id="withdrawCode"
                       placeholder="ZABA"
                       value={withdrawCode}
                       onChange={(e) => setWithdrawCode(e.target.value)}
                       className="h-10 mt-1"
                     />
                   </div>
                 </div>
                 <div className="flex flex-col xs:flex-row gap-2 mt-4">
                   <Button
                     onClick={handleWithdraw}
                     disabled={submittingWithdraw || available < 100}
                     className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white h-10"
                   >
                     {submittingWithdraw ? "Submitting..." : "Submit Request"}
                   </Button>
                   <Button variant="outline" onClick={() => setShowWithdrawForm(false)} className="flex-1 h-10">
                     Cancel
                   </Button>
                 </div>
               </CardContent>
             </Card>
           )}

          {/* Royalty History */}
          <Card className="bg-card border border-border rounded-2xl mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Download className="h-5 w-5" />
                Royalty History
              </CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border border-border rounded-lg px-2 py-1 bg-background"
                >
                  <option value="all">All Statuses</option>
                  <option value="cleared">Cleared</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : filteredRoyalties.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No royalty records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoyalties.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.date_earned}</TableCell>
                        <TableCell className="text-sm">{r.source || "Royalty"}</TableCell>
                        <TableCell className="text-right font-medium">${r.amount.toFixed(2)}</TableCell>
                        <TableCell>{royaltyStatusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Withdrawal History */}
          <Card className="bg-card border border-border rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" />
                Withdrawal History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="text-center py-10">
                  <ArrowUpRight className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No withdrawals yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-sm">{new Date(w.requested_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{w.bank_name}</TableCell>
                        <TableCell className="text-right font-medium">${w.amount.toFixed(2)}</TableCell>
                        <TableCell>{withdrawalStatusBadge(w.status)}</TableCell>
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

export default Royalties;
