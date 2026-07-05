import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { useToast } from "@/hooks/use-toast";
import { User, Wallet, ArrowUpRight, Download, Filter } from "lucide-react";

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [royalties, setRoyalties] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loadingRoyalties, setLoadingRoyalties] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawCode, setWithdrawCode] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const fetchRoyaltyData = async (userId: string) => {
    setLoadingRoyalties(true);
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
    setLoadingRoyalties(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchRoyaltyData(user.id);
    }
  }, [user, authLoading]);

  const totalCleared = royalties
    .filter((r) => r.status === "cleared")
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const totalPaid = withdrawals
    .filter((w) => w.status === "paid" || w.status === "approved")
    .reduce((sum, w) => sum + (w.amount || 0), 0);

  const availableBalance = Math.max(0, totalCleared - totalPaid);

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
      fetchRoyaltyData(user.id);
    }

    setSubmittingWithdraw(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>ZedBute | Settings</title>
        <meta name="description" content="Manage your account settings and royalty earnings." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-4xl">

          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Account Settings</h1>
          <p className="text-sm text-muted-foreground mb-6">Manage your account and view royalties.</p>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Profile</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-medium">{user?.email}</span>
              </div>
              {user?.user_metadata?.username && (
                <div>
                  <span className="text-muted-foreground">Username: </span>
                  <span className="font-medium">{user.user_metadata.username}</span>
                </div>
              )}
              {user?.user_metadata?.full_name && (
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">{user.user_metadata.full_name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6 bg-card border border-border rounded-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-foreground" />
                <div>
                  <CardTitle className="text-lg">Royalty Overview</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingRoyalties ? (
                <p className="text-sm text-muted-foreground">Loading royalty data...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Cleared</p>
                      <p className="text-2xl font-bold">${totalCleared.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Paid Out</p>
                      <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Available Balance</p>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className={`text-2xl font-bold ${availableBalance >= 100 ? "text-green-600" : "text-foreground"}`}>
                        ${availableBalance.toFixed(2)}
                      </p>
                      {availableBalance >= 100 ? (
                        <Button
                          onClick={() => setShowWithdrawForm(true)}
                          className="mt-3 w-full rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          Request Withdrawal
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-2">Minimum withdrawal: <strong>$100.00</strong></p>
                      )}
                    </div>
                  </div>

                  {showWithdrawForm && (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <h2 className="text-base font-semibold mb-4">Request Withdrawal</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          />
                        </div>
                        <div>
                          <Label htmlFor="withdrawBank" className="text-sm">Bank Name</Label>
                          <Input
                            id="withdrawBank"
                            placeholder="e.g., Zanaco"
                            value={withdrawBank}
                            onChange={(e) => setWithdrawBank(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="withdrawAccount" className="text-sm">Account Number</Label>
                          <Input
                            id="withdrawAccount"
                            placeholder="Account number"
                            value={withdrawAccount}
                            onChange={(e) => setWithdrawAccount(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="withdrawCode" className="text-sm">Bank Code / SWIFT</Label>
                          <Input
                            id="withdrawCode"
                            placeholder="ZABA"
                            value={withdrawCode}
                            onChange={(e) => setWithdrawCode(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <Button
                          onClick={handleWithdraw}
                          disabled={submittingWithdraw || availableBalance < 100}
                          className="flex-1 bg-gradient-primary text-primary-foreground"
                        >
                          {submittingWithdraw ? "Submitting..." : "Submit Request"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowWithdrawForm(false)} className="flex-1">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
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
              {loadingRoyalties ? (
                <p className="text-sm text-muted-foreground">Loading royalty history...</p>
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
                    {filteredRoyalties.map((royalty) => (
                      <TableRow key={royalty.id}>
                        <TableCell className="text-sm">{royalty.date_earned}</TableCell>
                        <TableCell className="text-sm">{royalty.source || "Royalty"}</TableCell>
                        <TableCell className="text-right font-medium">${royalty.amount.toFixed(2)}</TableCell>
                        <TableCell>{royaltyStatusBadge(royalty.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-lg mt-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" />
                Withdrawal History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRoyalties ? (
                <p className="text-sm text-muted-foreground">Loading withdrawal history...</p>
              ) : withdrawals.length === 0 ? (
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
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="text-sm">{new Date(withdrawal.requested_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{withdrawal.bank_name}</TableCell>
                        <TableCell className="text-right font-medium">${withdrawal.amount.toFixed(2)}</TableCell>
                        <TableCell>{withdrawalStatusBadge(withdrawal.status)}</TableCell>
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

export default Settings;
