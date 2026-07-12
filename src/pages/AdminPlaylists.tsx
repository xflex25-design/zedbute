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
import { Loader2, ShieldAlert, Plus, Pencil, Trash2 } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  genre: string | null;
  submission_fee: number;
  is_active: boolean;
}

const empty = {
  name: "",
  genre: "",
  submission_fee: "30",
  is_active: true,
};

const AdminPlaylists = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

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
      if (admin) await load();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function load() {
    const { data } = await (supabase as any)
      .from("playlists")
      .select("id, name, genre, submission_fee, is_active")
      .order("created_at", { ascending: true });
    setPlaylists(data || []);
  }

  function startEdit(p: Playlist) {
    setEditingId(p.id);
      setForm({
        name: p.name,
        genre: p.genre || "",
        submission_fee: String(p.submission_fee || 0),
        is_active: p.is_active,
      });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...empty });
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        genre: form.genre.trim() || null,
        submission_fee: parseFloat(form.submission_fee || "0") || 0,
        is_active: form.is_active,
      };
      let error;
      if (editingId) {
        ({ error } = await (supabase as any)
          .from("playlists")
          .update(payload)
          .eq("id", editingId));
      } else {
        ({ error } = await (supabase as any).from("playlists").insert(payload));
      }
      if (error) throw error;
      toast({ title: editingId ? "Playlist updated" : "Playlist added" });
      resetForm();
      await load();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this playlist?")) return;
    const { error } = await (supabase as any).from("playlists").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Playlist deleted" });
      await load();
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin — Playlists</h1>
          <Button variant="outline" onClick={() => navigate("/admin/playlist-submissions")}>
            Submissions
          </Button>
        </div>

        <Card className="shadow-card mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Edit Playlist" : "Add Playlist"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Afro Hits Zambia"
              />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Input
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                placeholder="Afrobeat"
              />
            </div>
            <div className="space-y-2">
              <Label>Submission Fee (ZMW)</Label>
              <Input
                type="number"
                value={form.submission_fee}
                onChange={(e) => setForm({ ...form, submission_fee: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active (visible to artists)
              </label>
              <div className="flex gap-2 ml-auto">
                {editingId && (
                  <Button variant="ghost" onClick={resetForm} disabled={saving}>
                    Cancel
                  </Button>
                )}
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {playlists.map((p) => (
            <Card key={p.id} className="shadow-card">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {p.name}
                    {!p.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.genre || "No genre"} · K{p.submission_fee}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {playlists.length === 0 && (
            <p className="text-muted-foreground text-center">No playlists yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPlaylists;
