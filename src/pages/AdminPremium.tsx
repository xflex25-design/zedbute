import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Crown, Loader as Loader2, Check, Clock } from "lucide-react";

type PremiumSub = {
  id: string;
  user_id: string;
  plan: string;
  amount: number;
  payment_status: string;
  status: string;
  transaction_id: string | null;
  phone_number: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
  full_name?: string;
  email?: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const statusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Approved</Badge>;
    case "pending_approval":
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Pending Approval</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground border-border">{status}</Badge>;
  }
};

const AdminPremium = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<PremiumSub[]>([]);
  const [approving, setApproving] = useState<string | null>(null);

  const loadSubs = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("premium_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load subscriptions", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as PremiumSub[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      rows.forEach((r) => {
        const p: any = byId.get(r.user_id);
        r.full_name = p?.full_name;
        r.email = p?.email;
      });
    }
    setSubs(rows);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
      if (admin) await loadSubs();
      else setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const approve = async (sub: PremiumSub) => {
    setApproving(sub.id);
    try {
      const { error } = await supabase.rpc("admin_approve_premium" as any, {
        p_subscription_id: sub.id,
      });
      if (error) throw error;
      toast({
        title: "Premium approved",
        description: `${sub.full_name || sub.email || "Subscriber"} now has ${sub.plan} access.`,
      });
      await loadSubs();
    } catch (err) {
      toast({
        title: "Approval failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 text-center">
          <p className="text-muted-foreground">You don't have access to this page.</p>
        </div>
      </div>
    );
  }

  const pending = subs.filter((s) => s.status === "pending_approval");
  const processed = subs.filter((s) => s.status !== "pending_approval");

  const SubCard = ({ sub }: { sub: PremiumSub }) => (
    <Card data-testid={`premium-sub-${sub.id}`}>
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{sub.full_name || "Unknown"}</p>
            {statusBadge(sub.status)}
            <Badge variant="outline" className="capitalize">{sub.plan}</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{sub.email || sub.user_id}</p>
          <p className="text-xs text-muted-foreground">
            K{Number(sub.amount).toFixed(2)} · {sub.payment_status} · requested {fmtDate(sub.created_at)}
            {sub.phone_number && ` · ${sub.phone_number}`}
            {sub.status === "approved" && sub.expires_at && ` · expires ${fmtDate(sub.expires_at)}`}
          </p>
        </div>
        {sub.status === "pending_approval" && (
          <Button
            variant="hero"
            size="sm"
            className="shrink-0"
            data-testid={`approve-${sub.id}`}
            disabled={approving === sub.id}
            onClick={() => approve(sub)}
          >
            {approving === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Approve</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Premium Subscribers | ZedBute Admin</title></Helmet>
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-4xl space-y-8" data-testid="admin-premium-page">
        <div className="flex items-center gap-3">
          <Crown className="h-7 w-7 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Premium Subscribers</h1>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Pending approval ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending subscriptions.</p>
          ) : (
            <div className="space-y-3">{pending.map((s) => <SubCard key={s.id} sub={s} />)}</div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Processed ({processed.length})</h2>
          {processed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No processed subscriptions yet.</p>
          ) : (
            <div className="space-y-3">{processed.map((s) => <SubCard key={s.id} sub={s} />)}</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminPremium;
