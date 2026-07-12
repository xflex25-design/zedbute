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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, ShieldAlert, CheckCircle2, XCircle, PencilLine } from "lucide-react";

type ReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "changes_requested";

interface Submission {
  id: string;
  artist_id: string;
  playlist_id: string;
  song_title: string;
  artist_name: string;
  release_link: string;
  curator_message: string | null;
  payment_status: string;
  review_status: ReviewStatus;
  admin_notes: string | null;
  created_at: string;
  playlist_name?: string;
  artist_email?: string;
}

const reviewBadge: Record<ReviewStatus, string> = {
  pending_review: "bg-amber-500 hover:bg-amber-500 text-white",
  approved: "bg-green-600 hover:bg-green-600 text-white",
  rejected: "bg-red-600 hover:bg-red-600 text-white",
  changes_requested: "bg-blue-600 hover:bg-blue-600 text-white",
};

const AdminPlaylistSubmissions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

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
      const admin = !!roles?.some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await loadSubs();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function loadSubs() {
    const { data: rows } = await (supabase as any)
      .from("playlist_submissions")
      .select(
        "id, artist_id, playlist_id, song_title, artist_name, release_link, curator_message, payment_status, review_status, admin_notes, created_at"
      )
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });

    const list = (rows || []) as Submission[];
    if (list.length === 0) {
      setSubs(list);
      return;
    }

    const playlistIds = [...new Set(list.map((s) => s.playlist_id))];
    const artistIds = [...new Set(list.map((s) => s.artist_id))];

    const [{ data: playlists }, { data: profiles }] = await Promise.all([
      (supabase as any)
        .from("playlists")
        .select("id, name")
        .in("id", playlistIds),
      supabase
        .from("profiles")
        .select("id, email, artist_name")
        .in("id", artistIds),
    ]);

    const pMap = new Map((playlists || []).map((p: any) => [p.id, p.name]));
    const aMap = new Map(
      (profiles || []).map((p: any) => [p.id, p.email])
    );

      setSubs(
        list.map((s) => ({
          ...s,
          playlist_name: (pMap.get(s.playlist_id) as string) || "Unknown",
          artist_email: (aMap.get(s.artist_id) as string) || "",
        }))
      );
    setNotes(Object.fromEntries(list.map((s) => [s.id, s.admin_notes || ""])));
  }

  async function review(id: string, status: ReviewStatus) {
    const note = (notes[id] || "").trim();
    if (status === "changes_requested" && !note) {
      toast({
        title: "Add a note",
        description: "Explain what the artist should change.",
        variant: "destructive",
      });
      return;
    }

    setActing(id);
    try {
      const { error } = await (supabase as any)
        .from("playlist_submissions")
        .update({ review_status: status, admin_notes: note || null })
        .eq("id", id);

      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke(
        "notify-playlist-status",
        { body: { submissionId: id, status, notes: note } }
      );

      if (fnError) {
        toast({
          title: "Status updated",
          description: "But the artist notification failed to send.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Updated", description: `Marked as ${status.replace("_", " ")}.` });
      }
      await loadSubs();
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActing(null);
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-bold">Admin — Playlist Submissions</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/playlists")}>
              Manage Playlists
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Releases
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {subs.map((s) => (
            <Card key={s.id} className="shadow-card">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">
                    {s.song_title}{" "}
                    <span className="text-muted-foreground font-normal">
                      by {s.artist_name}
                    </span>
                  </CardTitle>
                  <Badge className={reviewBadge[s.review_status]}>
                    {s.review_status.replace("_", " ")}
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  <span className="block sm:inline">{s.playlist_name}</span>
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline">{s.artist_email || "no email"}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <a
                  href={s.release_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                >
                  {s.release_link}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>

                {s.curator_message && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Artist message:</span>{" "}
                    {s.curator_message}
                  </p>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Admin note (optional)</Label>
                  <Input
                    value={notes[s.id] || ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [s.id]: e.target.value })
                    }
                    placeholder="Add a note for the artist (required for changes requested)"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => review(s.id, "approved")}
                    disabled={acting === s.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {acting === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => review(s.id, "rejected")}
                    disabled={acting === s.id}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => review(s.id, "changes_requested")}
                    disabled={acting === s.id}
                  >
                    <PencilLine className="h-4 w-4 mr-1" /> Request Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {subs.length === 0 && (
            <p className="text-muted-foreground text-center">
              No paid submissions awaiting review.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPlaylistSubmissions;
