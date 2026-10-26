import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ListMusic, Loader2, Send, Music2, Smartphone, CreditCard } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  genre: string | null;
  submission_fee: number;
  is_active: boolean;
  description: string | null;
  cover_image: string | null;
}

const PaymentBadges = () => (
  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
    <span className="text-xs text-gray-400 font-medium">Pay with:</span>
    <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full px-2 py-0.5 font-semibold">
      <Smartphone className="h-3 w-3" /> Airtel Money
    </span>
    <span className="inline-flex items-center gap-1 text-xs bg-yellow-400/20 text-yellow-200 border border-yellow-400/30 rounded-full px-2 py-0.5 font-semibold">
      <Smartphone className="h-3 w-3" /> MTN MoMo
    </span>
    <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-gray-300 border border-white/20 rounded-full px-2 py-0.5 font-medium">
      <CreditCard className="h-3 w-3" /> Card
    </span>
  </div>
);

const EmptyState = ({ onAction }: { onAction?: () => void }) => (
  <div className="text-center py-16 px-4">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
      <ListMusic className="h-8 w-8 text-primary" />
    </div>
    <h3 className="text-xl font-bold mb-2">No playlists available</h3>
    <p className="text-muted-foreground max-w-md mx-auto mb-6">
      We're curating new playlists every week. Check back soon or follow us on social media for updates.
    </p>
    {onAction && (
      <Button onClick={onAction} variant="outline">
        Refresh
      </Button>
    )}
  </div>
);

const MyPlaylists = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("playlists")
      .select("id, name, genre, description, submission_fee, cover_image, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Failed to load playlists",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPlaylists(data || []);
    }
    setLoading(false);
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
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 flex items-center justify-center gap-2">
              <ListMusic className="h-8 w-8 text-[#F7931E]" />
              Submit to Playlist
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get your music featured on ZedBute's curated playlists. Pick a
              playlist, submit your song, and pay securely with Airtel Money, MTN MoMo, or card.
            </p>
          </div>

          {playlists.length === 0 ? (
            <EmptyState onAction={loadPlaylists} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {playlists.map((p) => (
                <div
                  key={p.id}
                  className="group relative h-[400px] overflow-hidden rounded-2xl cursor-pointer border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-glow hover:border-white/20"
                  style={{ background: "#0f0f1a" }}
                  onClick={() => navigate(`/submit-to-playlist?playlist=${p.id}`)}
                >
                  {p.cover_image ? (
                    <img
                      src={p.cover_image}
                      alt={p.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      style={{ zIndex: 0 }}
                      onError={(e) => {
                        console.error("Failed to load playlist cover:", p.cover_image);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        zIndex: 0,
                        background:
                          "linear-gradient(135deg, hsl(220 25% 12%) 0%, hsl(280 30% 15%) 100%)",
                      }}
                    />
                  )}
                  <div
                    className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-90"
                    style={{
                      zIndex: 1,
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.2) 100%)",
                    }}
                  />
                  <div
                    className="relative z-10 flex flex-col h-full p-5 sm:p-6"
                    style={{ background: "transparent" }}
                  >
                    <div className="flex-1" />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <Music2 className="h-4 w-4 text-white" />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight drop-shadow-lg">
                          {p.name}
                        </h3>
                      </div>
                      {p.genre && (
                        <span className="inline-block bg-black/50 text-white/90 border border-white/20 backdrop-blur-md rounded-full px-3 py-0.5 text-xs font-semibold mb-2">
                          {p.genre}
                        </span>
                      )}
                      {p.description && (
                        <p className="text-sm text-gray-300 mt-2 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                      <div className="flex items-end justify-between gap-3 mt-4">
                        <div>
                          <p className="text-2xl sm:text-3xl font-bold text-white drop-shadow-md">
                            K{p.submission_fee}
                            <span className="text-sm font-normal text-gray-300 ml-1">
                              fee
                            </span>
                          </p>
                        </div>
                        <Button
                          className="bg-white text-black hover:bg-gray-100 font-semibold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/submit-to-playlist?playlist=${p.id}`);
                          }}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Submit
                        </Button>
                      </div>
                      <PaymentBadges />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPlaylists;
