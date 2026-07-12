import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, ShieldAlert, Save, Send } from "lucide-react";

type ClaimStatus =
  | "New"
  | "Instructions Sent"
  | "Awaiting Verification"
  | "Claimed"
  | "Rejected";

const CLAIM_STATUSES: ClaimStatus[] = [
  "New",
  "Instructions Sent",
  "Awaiting Verification",
  "Claimed",
  "Rejected",
];

interface Claim {
  id: string;
  platform: "Spotify" | "Boomplay";
  name: string;
  email: string;
  link: string | null;
  distributor: string | null;
  notes: string | null;
  payment_status: string;
  payment_transaction_id: string | null;
  payment_amount: number | null;
  claim_status: ClaimStatus;
  admin_notes: string | null;
  created_at: string;
}

const statusBadgeClass: Record<ClaimStatus, string> = {
  New: "bg-slate-500 hover:bg-slate-500 text-white",
  "Instructions Sent": "bg-primary hover:bg-primary text-primary-foreground",
  "Awaiting Verification": "bg-amber-500 hover:bg-amber-500 text-white",
  Claimed: "bg-green-600 hover:bg-green-600 text-white",
  Rejected: "bg-red-600 hover:bg-red-600 text-white",
};

const AdminSpotifyClaims = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [statusInputs, setStatusInputs] = useState<Record<string, ClaimStatus>>({});
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const tableFor = (platform: Claim["platform"]) =>
    platform === "Spotify" ? "spotify_claims" : "boomplay_claims";

  const functionFor = (platform: Claim["platform"]) =>
    platform === "Spotify"
      ? "send-spotify-claim-instructions"
      : "send-boomplay-claim-instructions";

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = !!roles?.some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await loadClaims();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function loadClaims() {
    const [spotifyRes, boomplayRes] = await Promise.all([
      (supabase as any)
        .from("spotify_claims")
        .select(
          "id, name, email, spotify_link, distributor, notes, payment_status, payment_transaction_id, payment_amount, claim_status, admin_notes, created_at"
        )
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("boomplay_claims")
        .select(
          "id, name, email, boomplay_link, distributor, notes, payment_status, payment_transaction_id, payment_amount, claim_status, admin_notes, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (spotifyRes.error) {
      toast({
        title: "Failed to load claims",
        description: spotifyRes.error.message,
        variant: "destructive",
      });
      return;
    }
    if (boomplayRes.error) {
      toast({
        title: "Failed to load claims",
        description: boomplayRes.error.message,
        variant: "destructive",
      });
      return;
    }

    const spotifyRows = (spotifyRes.data || []).map((r: any) => ({
      ...r,
      platform: "Spotify" as const,
      link: r.spotify_link ?? null,
    }));
    const boomplayRows = (boomplayRes.data || []).map((r: any) => ({
      ...r,
      platform: "Boomplay" as const,
      link: r.boomplay_link ?? null,
    }));

    const rows = [...spotifyRows, ...boomplayRows] as Claim[];
    setClaims(rows);
    setStatusInputs(Object.fromEntries(rows.map((r) => [r.id, r.claim_status])));
    setNotesInputs(Object.fromEntries(rows.map((r) => [r.id, r.admin_notes || ""])));
  }

  async function saveClaim(c: Claim) {
    setSaving(c.id);
    try {
      const { error } = await (supabase as any)
        .from(tableFor(c.platform))
        .update({
          claim_status: statusInputs[c.id],
          admin_notes: notesInputs[c.id] || null,
        })
        .eq("id", c.id);

      if (error) throw error;

      toast({ title: "Saved", description: `${c.name}'s claim updated.` });
      await loadClaims();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  async function resendInstructions(c: Claim) {
    setResending(c.id);
    try {
      const { error } = await supabase.functions.invoke(functionFor(c.platform), {
        body: {
          to_email: c.email,
          to_name: c.name,
          spotify_link: c.platform === "Spotify" ? c.link : null,
          boomplay_link: c.platform === "Boomplay" ? c.link : null,
        },
      });

      if (error) throw error;

      if (statusInputs[c.id] !== "Instructions Sent") {
        await (supabase as any)
          .from(tableFor(c.platform))
          .update({ claim_status: "Instructions Sent" })
          .eq("id", c.id);
      }

      toast({
        title: "Instructions resent",
        description: `Sent to ${c.email}.`,
      });
      await loadClaims();
    } catch (err: any) {
      toast({
        title: "Resend failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setResending(null);
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
              <p className="text-sm text-muted-foreground">
                You don't have access to this page.
              </p>
              <Button onClick={() => navigate("/dashboard")}>Back</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-1">Admin — Platform Claims</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Review submissions, update claim status, and add notes. Artists
          complete verification themselves on each platform's own site.
        </p>

        <div className="space-y-4">
          {claims.map((c) => (
            <Card key={c.id} className="shadow-card">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Badge
                      className={
                        c.platform === "Spotify"
                          ? "bg-green-600 hover:bg-green-600 text-white"
                          : "bg-[#F7931E] hover:bg-[#F7931E] text-white"
                      }
                    >
                      {c.platform}
                    </Badge>
                    {c.name}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-slate-500 hover:bg-slate-500 text-white">
                      Payment: {c.payment_status}
                    </Badge>
                    <Badge className={statusBadgeClass[c.claim_status]}>
                      {c.claim_status}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  <span className="block sm:inline">{c.email}</span>
                  {c.distributor && (
                    <>
                      <span className="hidden sm:inline"> · </span>
                      <span className="block sm:inline">{c.distributor}</span>
                    </>
                  )}
                  {c.payment_amount != null && (
                    <>
                      <span className="hidden sm:inline"> · </span>
                      <span className="block sm:inline">K{c.payment_amount}</span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {c.link && (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                  >
                    {c.link}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
                {c.notes && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Artist notes:</span> {c.notes}
                  </p>
                )}
                {c.payment_transaction_id && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Txn:</span>{" "}
                    {c.payment_transaction_id}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Claim status</Label>
                    <Select
                      value={statusInputs[c.id]}
                      onValueChange={(v) =>
                        setStatusInputs({ ...statusInputs, [c.id]: v as ClaimStatus })
                      }
                    >
                      <SelectTrigger className="bg-background w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {CLAIM_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2">
                    <Button
                      onClick={() => saveClaim(c)}
                      disabled={saving === c.id}
                      className="w-full sm:w-auto"
                    >
                      {saving === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" /> Save
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => resendInstructions(c)}
                      disabled={resending === c.id || saving === c.id}
                      className="w-full sm:w-auto"
                    >
                      {resending === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" /> Resend
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Admin notes</Label>
                  <Textarea
                    value={notesInputs[c.id] || ""}
                    onChange={(e) =>
                      setNotesInputs({ ...notesInputs, [c.id]: e.target.value })
                    }
                    rows={2}
                    placeholder="Internal notes (visible to the artist on their status page)"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {claims.length === 0 && (
            <p className="text-muted-foreground text-center">
              No claims yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSpotifyClaims;
