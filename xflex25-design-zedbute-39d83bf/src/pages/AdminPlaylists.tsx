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
import { Loader2, ShieldAlert, Plus, Pencil, Trash2, Music2 } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  genre: string | null;
  submission_fee: number;
  is_active: boolean;
  description: string | null;
  cover_image: string | null;
}

const empty = {
  name: "",
  genre: "",
  description: "",
  cover_image: "",
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
      .select("id, name, genre, description, cover_image, submission_fee, is_active")
      .order("created_at", { ascending: true });
    setPlaylists(data || []);
  }

  function startEdit(p: Playlist) {
    setEditingId(p.id);
      setForm({
        name: p.name,
        genre: p.genre || "",
        description: p.description || "",
        cover_image: p.cover_image || "",
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
        description: form.description.trim() || null,
        cover_image: form.cover_image.trim() || null,
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

        <div className="rounded-2xl border border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm shadow-card p-5 sm:p-8 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-5 text-white">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Edit Playlist" : "Add Playlist"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-200">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Afro Hits Zambia"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-200">Genre</Label>
              <Input
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                placeholder="Afrobeat"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium text-gray-200">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description shown on the playlist card"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium text-gray-200">Cover Image URL</Label>
              <Input
                value={form.cover_image}
                onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                placeholder="https://... .jpg"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-200">Submission Fee (ZMW)</Label>
              <Input
                type="number"
                value={form.submission_fee}
                onChange={(e) => setForm({ ...form, submission_fee: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-white/30 bg-white/5"
                />
                Active (visible to artists)
              </label>
              <div className="flex gap-2 ml-auto">
                {editingId && (
                  <Button variant="ghost" onClick={resetForm} disabled={saving} className="text-gray-300 hover:text-white hover:bg-white/10">
                    Cancel
                  </Button>
                )}
                <Button onClick={save} disabled={saving} className="bg-white text-black hover:bg-gray-100">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {playlists.map((p) => (
            <div
              key={p.id}
              className="group flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-[#0f0f1a]/60 p-4 transition-all duration-200 hover:border-white/20 hover:bg-white/5"
            >
              {p.cover_image ? (
                <img
                  src={p.cover_image}
                  alt={p.name}
                  className="w-16 h-16 object-cover rounded-lg shrink-0 ring-1 ring-white/10"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Music2 className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold flex items-center gap-2 text-white">
                  {p.name}
                  {!p.is_active && (
                    <Badge variant="secondary" className="bg-white/10 text-gray-300 border-white/20">Inactive</Badge>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {p.genre || "No genre"} · K{p.submission_fee}
                </p>
                {p.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                    {p.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(p)} className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white">
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => remove(p.id)} className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:text-red-300">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          ))}
          {playlists.length === 0 && (
            <div className="text-center py-12">
              <Music2 className="mx-auto h-12 w-12 text-gray-600 mb-3" />
              <p className="text-muted-foreground">No playlists yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPlaylists;
