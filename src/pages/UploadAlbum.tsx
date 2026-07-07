import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader as Loader2, Upload, Music, CircleAlert as AlertCircle, Calendar as CalendarIcon, Info, Plus, Minus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { FormProgress } from "@/components/FormProgress";

const LANGUAGES = [
  "English",
  "Bemba",
  "Nyanja",
  "Tonga",
  "Lozi",
  "Lunda",
  "Kaonde",
  "Luvale",
];

const GENRES = [
  "Afrobeat",
  "Gospel",
  "Hip Hop",
  "R&B",
  "Pop",
  "Reggae",
  "Traditional",
  "Dance",
  "Rock",
  "Jazz",
];

const ALBUM_PRICE = 500;
const ALBUM_MIN_TRACKS = 7;
const ALBUM_MAX_TRACKS = 30;

interface Track {
  id: string;
  title: string;
  file: File | null;
  trackNumber: number;
}

const UploadAlbum = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [uploadingTrackIndex, setUploadingTrackIndex] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [showReattachPrompt, setShowReattachPrompt] = useState(false);
  const [previousFileName, setPreviousFileName] = useState<string | null>(null);
  const coverScrollRef = useRef<HTMLDivElement>(null);
  const coverArtRef = useRef<HTMLInputElement>(null);
  const audioFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    producerName: "",
    legalName: "",
    genre: "",
    releaseDate: undefined as Date | undefined,
    coverArt: null as File | null,
    rightsConfirmed: false,
  });

  const [tracks, setTracks] = useState<Track[]>([
    { id: "1", title: "", file: null, trackNumber: 1 },
    { id: "2", title: "", file: null, trackNumber: 2 },
    { id: "3", title: "", file: null, trackNumber: 3 },
    { id: "4", title: "", file: null, trackNumber: 4 },
    { id: "5", title: "", file: null, trackNumber: 5 },
    { id: "6", title: "", file: null, trackNumber: 6 },
    { id: "7", title: "", file: null, trackNumber: 7 },
  ]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const pendingPayment = sessionStorage.getItem("pendingReleasePayment");
    const savedCoverName = sessionStorage.getItem("pendingCoverArtName");

    if (pendingPayment === "completed") {
      sessionStorage.removeItem("pendingReleasePayment");
      if (savedCoverName) {
        setShowReattachPrompt(true);
        setPreviousFileName(savedCoverName);
        toast({
          title: "Re-attach your cover art",
          description: "Please re-upload your cover art and audio files to complete your album.",
          variant: "default",
        });
        setTimeout(() => {
          coverScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [toast]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    setAuthChecked(true);
  };

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const isValid = img.width >= 1000 && img.height >= 1000 && img.width === img.height;
        if (!isValid) {
          toast({
            title: "Invalid Image Dimensions",
            description: "Cover art should be a square image at least 1000x1000 pixels.",
            variant: "destructive",
          });
        }
        resolve(isValid);
      };
      img.onerror = () => {
        toast({
          title: "Image Load Error",
          description: "Could not load the image. Please try a different file.",
          variant: "destructive",
        });
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setValidatingImage(true);
    const isValid = await validateImage(file);
    setValidatingImage(false);

    if (isValid) {
      setFormData({ ...formData, coverArt: file });
      setImagePreview(URL.createObjectURL(file));
      sessionStorage.setItem("pendingCoverArtName", file.name);
    } else {
      e.target.value = "";
    }
  };

  const handleTrackTitleChange = (id: string, title: string) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, title } : track
    ));
  };

  const handleTrackAudioChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an audio file (MP3, WAV, etc.)",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setTracks(tracks.map((track, i) =>
      i === index ? { ...track, file } : track
    ));
  };

  const addTrack = () => {
    if (tracks.length >= ALBUM_MAX_TRACKS) {
      toast({
        title: "Maximum Tracks Reached",
        description: `Albums are limited to ${ALBUM_MAX_TRACKS} tracks`,
        variant: "destructive",
      });
      return;
    }
    const newTrack: Track = {
      id: Date.now().toString(),
      title: "",
      file: null,
      trackNumber: tracks.length + 1
    };
    setTracks([...tracks, newTrack]);
  };

  const removeTrack = (id: string) => {
    if (tracks.length <= ALBUM_MIN_TRACKS) {
      toast({
        title: "Minimum Tracks Required",
        description: `Albums require at least ${ALBUM_MIN_TRACKS} tracks`,
        variant: "destructive",
      });
      return;
    }
    setTracks(tracks.filter(track => track.id !== id).map((track, index) => ({
      ...track,
      trackNumber: index + 1
    })));
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
  };

  const validateTracks = (): boolean => {
    const tracksWithFiles = tracks.filter(t => t.file);
    if (tracksWithFiles.length < ALBUM_MIN_TRACKS) {
      toast({
        title: "Insufficient Tracks",
        description: `Albums require a minimum of ${ALBUM_MIN_TRACKS} tracks. Please add more audio files.`,
        variant: "destructive",
      });
      return false;
    }
    if (tracksWithFiles.length > ALBUM_MAX_TRACKS) {
      toast({
        title: "Too Many Tracks",
        description: `Albums are limited to a maximum of ${ALBUM_MAX_TRACKS} tracks.`,
        variant: "destructive",
      });
      return false;
    }
    for (const track of tracks) {
      if (!track.title.trim() && track.file) {
        toast({
          title: "Missing Track Title",
          description: `Please enter a title for track ${track.trackNumber}`,
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "Missing Title",
        description: "Please enter an album title",
        variant: "destructive",
      });
      return;
    }

    if (!formData.artistName.trim()) {
      toast({
        title: "Missing Artist Name",
        description: "Please enter the artist name",
        variant: "destructive",
      });
      return;
    }

    if (selectedLanguages.length === 0) {
      toast({
        title: "No Language Selected",
        description: "Please select at least one language",
        variant: "destructive",
      });
      return;
    }

    if (!formData.genre) {
      toast({
        title: "No Genre Selected",
        description: "Please select a genre",
        variant: "destructive",
      });
      return;
    }

    if (!validateTracks()) return;

    if (!formData.coverArt) {
      toast({
        title: "No Cover Art",
        description: "Please upload cover art (3000x3000 pixels)",
        variant: "destructive",
      });
      return;
    }

    if (!formData.releaseDate) {
      toast({
        title: "Missing Release Date",
        description: "Please pick a release date",
        variant: "destructive",
      });
      return;
    }

    if (!formData.rightsConfirmed) {
      toast({
        title: "Rights Confirmation Required",
        description: "You must confirm that you own the rights to this music",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = formData.coverArt.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("cover-art")
        .upload(fileName, formData.coverArt);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("cover-art")
        .getPublicUrl(fileName);

      setUploadProgress(20);

      const { data: inserted, error: insertError } = await supabase
        .from("music_releases")
        .insert({
          user_id: user.id,
          title: formData.title,
          artist_name: formData.artistName,
          producer_name: formData.producerName || null,
          legal_name: formData.legalName || null,
          language: selectedLanguages,
          release_type: "album",
          genre: formData.genre,
          release_date: format(formData.releaseDate, "yyyy-MM-dd"),
          cover_art_url: publicUrl,
          rights_confirmed: formData.rightsConfirmed,
          status: "unpaid",
          upload_progress: 0,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      setUploadProgress(40);

      const trackUrls: { title: string; url: string; trackNumber: number }[] = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (!track.file) continue;

        setUploadingTrackIndex(i);
        setAudioUploadProgress(0);

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }

        progressIntervalRef.current = setInterval(() => {
          setAudioUploadProgress((prev) => (prev >= 90 ? 90 : prev + 10));
        }, 300);

        const audioExt = track.file.name.split(".").pop();
        const audioFileName = `${user.id}/${inserted.id}/track_${track.trackNumber}_${Date.now()}.${audioExt}`;

        const { error: audioUploadError } = await supabase.storage
          .from("audio-files")
          .upload(audioFileName, track.file);

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        if (audioUploadError) throw audioUploadError;
        setAudioUploadProgress(100);

        const { data: { publicUrl: trackUrl } } = supabase.storage
          .from("audio-files")
          .getPublicUrl(audioFileName);

        trackUrls.push({ title: track.title, url: trackUrl, trackNumber: track.trackNumber });

        const progressPerTrack = 60 / tracks.filter(t => t.file).length;
        setUploadProgress(40 + (trackUrls.length * progressPerTrack));
      }

      const { error: tracksError } = await supabase
        .from("release_tracks")
        .insert(
          trackUrls.map((t) => ({
            release_id: inserted.id,
            track_number: t.trackNumber,
            title: t.title,
            audio_url: t.url,
          }))
        );

      if (tracksError) throw tracksError;

      setUploadProgress(100);

      toast({
        title: "Album Saved",
        description: "Redirecting you to complete payment...",
      });

      sessionStorage.setItem("pendingReleasePayment", "started");

      navigate(`/payment?type=album&releaseId=${inserted.id}&amount=${ALBUM_PRICE}`);

    } catch (error: any) {
      console.error("Error submitting album:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred while submitting your album",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setAudioUploadProgress(0);
      setUploadingTrackIndex(null);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  };

  if (!user || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const uploadedTracksCount = tracks.filter(t => t.file).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-6 w-6" />
              Upload Album
            </CardTitle>
            <CardDescription>
              Submit your Album for distribution to Spotify, Apple Music, Boomplay, TikTok, and 150+ platforms.
            </CardDescription>
            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-600 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Your album will be saved as <strong>unpaid</strong> and you'll be redirected to complete the <strong>K{ALBUM_PRICE}</strong> payment.</span>
              </p>
            </div>
            <div className="mt-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-xs text-blue-600">
                <strong>Album Requirements:</strong> {ALBUM_MIN_TRACKS}-{ALBUM_MAX_TRACKS} tracks required. Current: {uploadedTracksCount} tracks
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <FormProgress
              steps={[
                { label: "Title", completed: formData.title.trim().length > 0 },
                { label: "Language", completed: selectedLanguages.length > 0 },
                { label: "Tracks", completed: uploadedTracksCount >= ALBUM_MIN_TRACKS },
                { label: "Genre", completed: !!formData.genre },
                { label: "Release Date", completed: !!formData.releaseDate },
                { label: "Cover Art", completed: !!formData.coverArt },
                { label: "Rights Confirmed", completed: formData.rightsConfirmed },
              ]}
            />
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Artist Name */}
              <div className="space-y-2">
                <Label htmlFor="artistName">Artist Name *</Label>
                <Input
                  id="artistName"
                  value={formData.artistName}
                  onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                  placeholder="Your artist/band name"
                  required
                  maxLength={100}
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Album Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter your album title"
                  required
                />
              </div>

              {/* Producer Name - Optional */}
              <div className="space-y-2">
                <Label htmlFor="producerName">Producer Name (Optional)</Label>
                <Input
                  id="producerName"
                  value={formData.producerName}
                  onChange={(e) => setFormData({ ...formData, producerName: e.target.value })}
                  placeholder="Name of the producer"
                  maxLength={100}
                />
              </div>

              {/* Legal Name - Optional */}
              <div className="space-y-2">
                <Label htmlFor="legalName">Full Legal Name (Optional)</Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="Your full legal name for royalty payments"
                  maxLength={150}
                />
              </div>

              {/* Language Selection */}
              <div className="space-y-3">
                <Label>Language(s) *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {LANGUAGES.map((language) => (
                    <div key={language} className="flex items-center space-x-2">
                      <Checkbox
                        id={language}
                        checked={selectedLanguages.includes(language)}
                        onCheckedChange={() => handleLanguageToggle(language)}
                      />
                      <Label htmlFor={language} className="cursor-pointer font-normal">
                        {language}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Track List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Tracks * ({ALBUM_MIN_TRACKS}-{ALBUM_MAX_TRACKS} required)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTrack}
                      disabled={tracks.length >= ALBUM_MAX_TRACKS}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeTrack(tracks[tracks.length - 1].id)}
                      disabled={tracks.length <= ALBUM_MIN_TRACKS}
                    >
                      <Minus className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>

                {tracks.map((track, index) => (
                  <div key={track.id} className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Track {track.trackNumber}</Label>
                      {track.file && (
                        <span className="text-xs text-muted-foreground">
                          {(track.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}
                    </div>
                    <Input
                      value={track.title}
                      onChange={(e) => handleTrackTitleChange(track.id, e.target.value)}
                      placeholder={`Track ${track.trackNumber} title`}
                      maxLength={100}
                    />
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      {track.file ? (
                        <div className="space-y-2">
                          <Music className="mx-auto h-8 w-8 text-primary" />
                          <p className="text-sm font-medium truncate">{track.file.name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTracks(tracks.map((t, i) =>
                                i === index ? { ...t, file: null } : t
                              ));
                              if (audioFileRefs.current[index]) {
                                audioFileRefs.current[index]!.value = "";
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">
                            <Label
                              htmlFor={`track-audio-${index}`}
                              className="cursor-pointer text-primary hover:underline"
                            >
                              Click to upload
                            </Label>
                          </div>
                          <Input
                            id={`track-audio-${index}`}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => handleTrackAudioChange(index, e)}
                            className="hidden"
                            ref={el => audioFileRefs.current[index] = el}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Genre */}
              <div className="space-y-2">
                <Label htmlFor="genre">Genre *</Label>
                <Select
                  value={formData.genre}
                  onValueChange={(value) => setFormData({ ...formData, genre: value })}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border border-border shadow-lg z-50">
                    {GENRES.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Release Date */}
              <div className="space-y-2">
                <Label>Release Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.releaseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.releaseDate ? format(formData.releaseDate, "PPP") : <span>Pick a release date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.releaseDate}
                      onSelect={(date) => setFormData({ ...formData, releaseDate: date })}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Your music will be processed and distributed within <strong className="text-foreground">2 weeks</strong> from submission.
                    {formData.releaseDate && (
                      <span> Estimated live date: <strong className="text-primary">{format(addWeeks(formData.releaseDate, 2), "PPP")}</strong></span>
                    )}
                  </p>
                </div>
              </div>

              {/* Cover Art */}
              <div className="space-y-3">
                <Label htmlFor="coverArt" className="flex items-center gap-2">
                  Cover Art *
                  <span className="text-xs text-muted-foreground font-normal">(Required: 3000 x 3000 pixels)</span>
                </Label>
                <div ref={coverScrollRef} className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  {imagePreview ? (
                    <div className="space-y-4">
                      <img
                        src={imagePreview}
                        alt="Cover preview"
                        className="mx-auto max-w-xs rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setImagePreview(null);
                          setFormData({ ...formData, coverArt: null });
                          sessionStorage.removeItem("pendingCoverArtName");
                        }}
                      >
                        Remove Image
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {showReattachPrompt && previousFileName && (
                        <p className="text-sm text-primary font-medium">
                          Please re-attach: {previousFileName}
                        </p>
                      )}
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        <Label
                          htmlFor="coverArt"
                          className="cursor-pointer text-primary hover:underline"
                        >
                          Click to upload
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Image must be exactly 3000 x 3000 pixels
                      </p>
                    </div>
                  )}
                  <Input
                    id="coverArt"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    ref={coverArtRef}
                    disabled={validatingImage}
                  />
                </div>
                {validatingImage && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Validating image dimensions...
                  </p>
                )}
              </div>

              {/* Rights Confirmation */}
              <div className="flex items-start space-x-3 rounded-lg border border-border p-4 bg-muted/50">
                <Checkbox
                  id="rights"
                  checked={formData.rightsConfirmed}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, rightsConfirmed: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="rights" className="cursor-pointer flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    I own the rights to this music *
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    By checking this box, you confirm that you have all necessary rights,
                    licenses, and permissions to distribute this music.
                  </p>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {uploadingTrackIndex !== null
                        ? `Uploading track ${uploadingTrackIndex + 1}...`
                        : "Uploading..."
                      }
                    </span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || validatingImage}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Album...
                  </>
                ) : validatingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating image...
                  </>
                ) : (
                  `Save & Pay K${ALBUM_PRICE}`
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Your album will be saved as unpaid before you're redirected to payment
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadAlbum;
