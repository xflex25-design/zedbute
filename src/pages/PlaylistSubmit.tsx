import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ListMusic, Send } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  genre: string | null;
  submission_fee: number;
  cover_image: string | null;
}

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const PlaylistSubmit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const presetPlaylist = searchParams.get("playlist");

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<string[]>(
    presetPlaylist ? [presetPlaylist] : []
  );
  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [releaseLink, setReleaseLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [playlistsRes, profileRes] = await Promise.all([
      (supabase as any)
        .from("playlists")
        .select("id, name, genre, submission_fee, cover_image")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("artist_name, full_name")
        .maybeSingle(),
    ]);

    if (playlistsRes.error) {
      toast({
        title: "Failed to load playlists",
        description: playlistsRes.error.message,
        variant: "destructive",
      });
    } else {
      setPlaylists(playlistsRes.data || []);
    }
    if (profileRes.data) {
      setArtistName(
        profileRes.data.artist_name || profileRes.data.full_name || ""
      );
    }
    setLoading(false);
  }

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const total = playlists
    .filter((p) => selected.includes(p.id))
    .reduce((sum, p) => sum + Number(p.submission_fee || 0), 0);

  async function handleSubmit() {
    if (!songTitle.trim()) {
      toast({ title: "Song title required", variant: "destructive" });
      return;
    }
    if (!artistName.trim()) {
      toast({ title: "Artist name required", variant: "destructive" });
      return;
    }
    if (!isValidUrl(releaseLink)) {
      toast({
        title: "Valid release link required",
        description: "Enter a full URL (https://...).",
        variant: "destructive",
      });
      return;
    }
    if (selected.length === 0) {
      toast({
        title: "Select at least one playlist",
        variant: "destructive",
      });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/auth");
      return;
    }

    setSubmitting(true);
    try {
      const batchId = crypto.randomUUID();
      const rows = selected.map((playlistId) => ({
        artist_id: session.user.id,
        playlist_id: playlistId,
        song_title: songTitle.trim(),
        artist_name: artistName.trim(),
        release_link: releaseLink.trim(),
        curator_message: message.trim() || null,
        payment_batch_id: batchId,
        payment_status: "pending_payment",
        review_status: "pending_review",
      }));

      const { error } = await (supabase as any)
        .from("playlist_submissions")
        .insert(rows);

      if (error) throw error;

      navigate(
        `/payment?type=playlist-submission&batchId=${batchId}&amount=${total}`
      );
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err?.message ?? "Could not save your submission.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <ListMusic className="h-7 w-7 text-[#F7931E]" />
              Submit to Playlist
            </h1>
            <p className="text-muted-foreground">
              Send your song to one or more ZedBute playlists. You'll pay the
              combined submission fee, then our curators review it.
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Submission details</CardTitle>
              <CardDescription>
                Fill in your song and pick the playlists you want.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Song Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="e.g. Summer Vibes"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Artist Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Your artist name"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Release Link (Boomplay) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="url"
                  value={releaseLink}
                  onChange={(e) => setReleaseLink(e.target.value)}
                  placeholder="https://boomplay.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Select Playlist(s) <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {playlists.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No playlists available.
                    </p>
                  )}
                  {playlists.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.includes(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      {p.cover_image && (
                        <img
                          src={p.cover_image}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded shrink-0"
                        />
                      )}
                      <span className="flex-1 text-sm font-medium">
                        {p.name}
                        {p.genre && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {p.genre}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold">
                        K{p.submission_fee}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Message to Curator (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Anything you'd like the curator to know"
                  rows={3}
                />
              </div>

              {selected.length > 0 && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total ({selected.length} playlist
                    {selected.length > 1 ? "s" : ""})
                  </span>
                  <span className="text-2xl font-bold">K{total}</span>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Submit & Continue to Payment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlaylistSubmit;
