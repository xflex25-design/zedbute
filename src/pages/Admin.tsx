import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";

const EMAILJS = {
  publicKey: "y6dBkyYNeiQ5-ONrT",
  serviceId: "service_m5ipkn6",
  templateId: "template_h6m0hkf",
};

const COMPLETION_MESSAGE =
  "Your music has been successfully distributed to all major streaming platforms including Spotify, Apple Music, Boomplay, YouTube Music, Tidal, Deezer and Amazon Music. Share your links, tell your fans and let the streams roll in! Thank you for trusting ZedBute. — The ZedBute Team";

interface Release {
  id: string;
  user_id: string;
  title: string;
  artist_name: string;
  status: string;
  upload_progress: number | null;
  completion_email_sent_at: string | null;
  profile_email?: string;
  profile_name?: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [progressInputs, setProgressInputs] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    emailjs.init({ publicKey: EMAILJS.publicKey });
  }, []);
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await loadReleases();
    };
    init();
  }, [navigate]);

  const loadReleases = async () => {
    const { data: rels } = await supabase
      .from("music_releases")
      .select("*")
      .order("created_at", { ascending: false });
    if (!rels) return;
    const userIds = [...new Set(rels.map((r) => r.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id,email,full_name,artist_name").in("id", userIds);
    const profMap = new Map((profs || []).map((p) => [p.id, p]));
    const merged = rels.map((r: any) => ({
      ...r,
      profile_email: profMap.get(r.user_id)?.email,
      profile_name: profMap.get(r.user_id)?.artist_name || profMap.get(r.user_id)?.full_name,
    }));
    setReleases(merged);
    setProgressInputs(Object.fromEntries(merged.map((r) => [r.id, r.upload_progress ?? 0])));
  };

  const saveProgress = async (release: Release) => {
    const newProgress = Math.max(0, Math.min(100, progressInputs[release.id] ?? 0));
    setSaving(release.id);
    try {
      const updates: any = { upload_progress: newProgress };
      if (newProgress === 100 && release.status !== "distributed") {
        updates.status = "distributed";
        updates.distributed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("music_releases").update(updates).eq("id", release.id);
      if (error) throw error;

      // Auto email on 100%, only once
      if (newProgress === 100 && !release.completion_email_sent_at) {
        if (!release.profile_email) {
          toast({ title: "No email on file", description: "Cannot send completion email.", variant: "destructive" });
        } else {
          try {
            await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
              to_email: release.profile_email,
              to_name: release.profile_name || release.artist_name,
              message: COMPLETION_MESSAGE,
            });
            await supabase
              .from("music_releases")
              .update({ completion_email_sent_at: new Date().toISOString() })
              .eq("id", release.id);
            setBanner(`Completion email sent to ${release.profile_email}`);
            setTimeout(() => setBanner(null), 5000);
          } catch (emailErr: any) {
            toast({
              title: "Email failed",
              description: emailErr?.text || emailErr?.message || "EmailJS error",
              variant: "destructive",
            });
          }
        }
      }
      await loadReleases();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="pt-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Navbar user={user} />
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
    <div className="min-h-screen bg-gradient-hero">
      <Navbar user={user} />
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-12 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Admin — Releases</h1>
        {banner && (
          <div className="mb-4 p-3 bg-green-100 border border-green-500 text-green-800 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> {banner}
          </div>
        )}
        <div className="space-y-4">
          {releases.map((r) => (
            <Card key={r.id} className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">{r.title}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  <span className="block sm:inline">{r.artist_name}</span>
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline">{r.profile_email || "no email"}</span>
                  <span className="hidden sm:inline"> · status: </span>
                  <span className="block sm:inline">{r.status}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progressInputs[r.id] ?? 0} className="h-2" />
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-sm">Distribution progress (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={progressInputs[r.id] ?? 0}
                      onChange={(e) =>
                        setProgressInputs({ ...progressInputs, [r.id]: parseInt(e.target.value || "0", 10) })
                      }
                      className="h-10 sm:h-9"
                    />
                  </div>
                  <Button onClick={() => saveProgress(r)} disabled={saving === r.id} className="w-full sm:w-auto h-10 sm:h-9">
                    {saving === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
                {r.completion_email_sent_at && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Completion email sent
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {releases.length === 0 && <p className="text-muted-foreground text-center">No releases yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default Admin;
