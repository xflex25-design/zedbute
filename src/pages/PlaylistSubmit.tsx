import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ListMusic, Send, Music2, Smartphone } from "lucide-react";

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

const PaymentBadges = () => (
  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/10">
    <span className="text-xs text-gray-400 font-medium">Pay with:</span>
    <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full px-2 py-0.5 font-semibold">
      <Smartphone className="h-3 w-3" /> Airtel Money
    </span>
    <span className="inline-flex items-center gap-1 text-xs bg-yellow-400/20 text-yellow-200 border border-yellow-400/30 rounded-full px-2 py-0.5 font-semibold">
      <Smartphone className="h-3 w-3" /> MTN MoMo
    </span>
    <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-gray-300 border border-white/20 rounded-full px-2 py-0.5 font-medium">
      <CreditCard className="h-3 w-3" /> Card (Stripe)
    </span>
  </div>
);

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 flex items-center justify-center gap-2">
              <ListMusic className="h-8 w-8 text-[#F7931E]" />
              Submit to Playlist
            </h1>
            <p className="text-muted-foreground">
              Send your song to one or more ZedBute playlists. You'll pay the
              combined submission fee securely, then our curators review it.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f0f1a]/80 backdrop-blur-sm shadow-card p-5 sm:p-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">
                Song Title <span className="text-red-400">*</span>
              </Label>
              <Input
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="e.g. Summer Vibes"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">
                Artist Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Your artist name"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">
                Release Link (Boomplay) <span className="text-red-400">*</span>
              </Label>
              <Input
                type="url"
                value={releaseLink}
                onChange={(e) => setReleaseLink(e.target.value)}
                placeholder="https://boomplay.com/..."
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-200">
                Select Playlist(s) <span className="text-red-400">*</span>
              </Label>
              <div className="space-y-2">
                {playlists.length === 0 ? (
                  <div className="text-center py-8 rounded-lg border border-dashed border-white/10 bg-white/5">
                    <Music2 className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No playlists available right now.</p>
                  </div>
                ) : (
                  playlists.map((p) => {
                    const isSelected = selected.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                          isSelected
                            ? "border-primary/50 bg-primary/10 shadow-glow/20"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(p.id)}
                          className="border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        {p.cover_image && (
                          <img
                            src={p.cover_image}
                            alt={p.name}
                            className="w-11 h-11 object-cover rounded-lg shrink-0 ring-1 ring-white/10"
                          />
                        )}
                        <span className="flex-1 text-sm font-medium text-gray-200">
                          {p.name}
                          {p.genre && (
                            <span className="text-gray-400 font-normal">
                              {" "}
                              · {p.genre}
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-bold text-white">
                          K{p.submission_fee} <span className="text-xs text-gray-400">(${(p.submission_fee / 25).toFixed(2)} USD)</span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">Message to Curator (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Anything you'd like the curator to know"
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20 resize-none"
              />
            </div>

            {selected.length > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-300">
                    Total ({selected.length} playlist{selected.length > 1 ? "s" : ""})
                  </span>
                   <span className="text-3xl font-bold text-white">K{total} <span className="text-base text-gray-400">(${(total / 25).toFixed(2)} USD)</span></span>
                </div>
                <PaymentBadges />
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistSubmit;
