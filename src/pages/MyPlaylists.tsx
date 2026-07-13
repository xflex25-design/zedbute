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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ListMusic, Loader2, Send } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  genre: string | null;
  submission_fee: number;
  is_active: boolean;
  description: string | null;
  cover_image: string | null;
}

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
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <ListMusic className="h-7 w-7 text-[#F7931E]" />
              Submit to Playlist
            </h1>
            <p className="text-muted-foreground">
              Get your music featured on ZedBute's curated playlists. Pick a
              playlist and submit your song.
            </p>
          </div>

          {playlists.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No playlists available right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {playlists.map((p) => (
                <Card
                  key={p.id}
                  className="shadow-card overflow-hidden relative group cursor-pointer border-white/20 bg-transparent"
                  style={{ minHeight: "360px" }}
                  onClick={() => navigate(`/submit-to-playlist?playlist=${p.id}`)}
                >
                  {p.cover_image && (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url(${p.cover_image})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/20 group-hover:from-black/90 transition-colors" />
                  <div className="relative z-10 flex flex-col h-full p-6">
                    <div className="flex-1" />
                    <div>
                      <CardHeader className="p-0 mb-3">
                        <CardTitle className="text-3xl font-bold text-white leading-tight drop-shadow-lg">
                          {p.name}
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2 text-gray-100 font-medium mt-2">
                          {p.genre && (
                            <Badge variant="secondary" className="bg-black/60 text-white border-white/40 backdrop-blur-md">
                              {p.genre}
                            </Badge>
                          )}
                        </CardDescription>
                        {p.description && (
                          <p className="text-sm text-gray-200 mt-2 line-clamp-2 drop-shadow">
                            {p.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="p-0 space-y-3">
                        <div className="flex items-end justify-between gap-3">
                          <p className="text-3xl font-bold text-white drop-shadow-md">
                            K{p.submission_fee}
                            <span className="text-base font-normal text-gray-200">
                              {" "}submission fee
                            </span>
                          </p>
                          <Button
                            className="bg-white text-black hover:bg-gray-100 font-semibold shadow-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/submit-to-playlist?playlist=${p.id}`);
                            }}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Submit
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPlaylists;
