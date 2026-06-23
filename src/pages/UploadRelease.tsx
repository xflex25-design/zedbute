import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader as Loader2, Upload, Music, CircleAlert as AlertCircle, Calendar as CalendarIcon, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addWeeks, addDays } from "date-fns";
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

const UploadRelease = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [showReattachPrompt, setShowReattachPrompt] = useState(false);
  const [previousFileName, setPreviousFileName] = useState<string | null>(null);
  const [savedAudioFileName, setSavedAudioFileName] = useState<string | null>(null);
  const coverScrollRef = useRef<HTMLDivElement>(null);
  const coverArtRef = useRef<HTMLInputElement>(null);
  const audioScrollRef = useRef<HTMLDivElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    releaseType: "single",
    genre: "",
    releaseDate: addWeeks(new Date(), 2) as Date | undefined,
    coverArt: null as File | null,
    audioFile: null as File | null,
    rightsConfirmed: false,
  });

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
    const savedAudioName = sessionStorage.getItem("pendingAudioFileName");

    if (pendingPayment === "completed") {
      sessionStorage.removeItem("pendingReleasePayment");
      if (savedCoverName || savedAudioName) {
        setShowReattachPrompt(true);
        setPreviousFileName(savedCoverName);
        setSavedAudioFileName(savedAudioName);
        toast({
          title: "Re-attach your files",
          description: "Please re-upload your cover art and audio file to complete your release.",
          variant: "default",
        });
        setTimeout(() => {
          coverScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [toast]);

  const checkUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      navigate("/auth");
      return;
    }
    setUser(authUser);
    setAuthChecked(true);
  };

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const isValid = img.width >= 1400 && img.height >= 1400;
        if (!isValid) {
          toast({
            title: "Invalid Image Size",
            description: "Cover art must be at least 1400x1400 pixels. Smaller images may be rejected by platforms.",
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

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setFormData({ ...formData, audioFile: file });
    sessionStorage.setItem("pendingAudioFileName", file.name);
  };

  const handleLanguageToggle = (language: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({ title: "Missing Title", description: "Please enter a release title", variant: "destructive" });
      return;
    }
    if (!formData.artistName.trim()) {
      toast({ title: "Missing Artist Name", description: "Please enter the artist name", variant: "destructive" });
      return;
    }
    if (selectedLanguages.length === 0) {
      toast({ title: "No Language Selected", description: "Please select at least one language", variant: "destructive" });
      return;
    }
    if (!formData.genre) {
      toast({ title: "No Genre Selected", description: "Please select a genre", variant: "destructive" });
      return;
    }
    if (!formData.coverArt) {
      toast({ title: "No Cover Art", description: "Please upload cover art (minimum 1400x1400 pixels)", variant: "destructive" });
      return;
    }
    if (!formData.audioFile) {
      toast({ title: "No Audio File", description: "Please upload your music audio file", variant: "destructive" });
      return;
    }
    if (!formData.releaseDate) {
      toast({ title: "Missing Release Date", description: "Please pick a release date", variant: "destructive" });
      return;
    }
    if (!formData.rightsConfirmed) {
      toast({ title: "Rights Confirmation Required", description: "You must confirm that you own the rights to this music", variant: "destructive" });
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

      setUploadProgress(30);

      setIsUploadingAudio(true);
      setAudioUploadProgress(0);
      const audioExt = formData.audioFile!.name.split(".").pop();
      const audioFileName = `${user.id}/${Date.now()}.${audioExt}`;

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      progressIntervalRef.current = setInterval(() => {
        setAudioUploadProgress((prev) => (prev >= 90 ? 90 : prev + 10));
      }, 300);

      const { error: audioUploadError } = await supabase.storage
        .from("audio-files")
        .upload(audioFileName, formData.audioFile!);

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (audioUploadError) {
        setIsUploadingAudio(false);
        setAudioUploadProgress(0);
        throw audioUploadError;
      }
      setAudioUploadProgress(100);
      setIsUploadingAudio(false);

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from("audio-files")
        .getPublicUrl(audioFileName);

      setUploadProgress(70);

      const { data: inserted, error: insertError } = await supabase
        .from("music_releases")
        .insert({
          user_id: user.id,
          title: formData.title,
          artist_name: formData.artistName,
          language: selectedLanguages,
          release_type: formData.releaseType,
          genre: formData.genre,
          release_date: format(formData.releaseDate, "yyyy-MM-dd"),
          cover_art_url: publicUrl,
          audio_url: audioUrl,
          rights_confirmed: formData.rightsConfirmed,
          status: "unpaid",
          upload_progress: 0,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      setUploadProgress(100);

      toast({
        title: "Release Saved",
        description: "Redirecting you to complete payment...",
      });

      sessionStorage.setItem("pendingReleasePayment", "started");
      navigate(`/payment?type=release&releaseId=${inserted.id}`);

    } catch (error: any) {
      console.error("Error submitting release:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred while submitting your release",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setAudioUploadProgress(0);
      setIsUploadingAudio(false);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-6 w-6" />
              Upload Music Release
            </CardTitle>
            <CardDescription>
              Submit your music for distribution to Boomplay and Spotify. Processing takes up to 2 weeks.
            </CardDescription>
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Your release will be saved as <strong>unpaid</strong> and you'll be redirected to complete the K50 payment.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <FormProgress
              steps={[
                { label: "Title", completed: formData.title.trim().length > 0 },
                { label: "Language", completed: selectedLanguages.length > 0 },
                { label: "Release Type", completed: !!formData.releaseType },
                { label: "Genre", completed: !!formData.genre },
                { label: "Release Date", completed: !!formData.releaseDate },
                { label: "Cover Art", completed: !!formData.coverArt },
                { label: "Audio File", completed: !!formData.audioFile },
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
                <Label htmlFor="title">Release Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter your release title"
                  required
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

              {/* Release Type */}
              <div className="space-y-3">
                <Label>Release Type *</Label>
                <RadioGroup
                  value={formData.releaseType}
                  onValueChange={(value) => setFormData({ ...formData, releaseType: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="cursor-pointer font-normal">Single</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ep" id="ep" />
                    <Label htmlFor="ep" className="cursor-pointer font-normal">EP</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="album" id="album" />
                    <Label htmlFor="album" className="cursor-pointer font-normal">Album</Label>
                  </div>
                </RadioGroup>
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
                  <SelectContent className="bg-background z-50">
                    {GENRES.map((genre) => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Release Date */}
              <div className="space-y-2">
                <Label>Release Date *</Label>
                <RadioGroup
                  value={formData.releaseDate ? format(formData.releaseDate, "yyyy-MM-dd") : ""}
                  onValueChange={(value) => {
                    if (value === "custom") return;
                    setFormData({ ...formData, releaseDate: new Date(value) });
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <div 
                    className={cn(
                      "flex items-center justify-between space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors",
                      formData.releaseDate && format(formData.releaseDate, "yyyy-MM-dd") === format(addWeeks(new Date(), 2), "yyyy-MM-dd") && "border-primary bg-primary/5"
                    )}
                    onClick={() => setFormData({ ...formData, releaseDate: addWeeks(new Date(), 2) })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem 
                        value={format(addWeeks(new Date(), 2), "yyyy-MM-dd")} 
                        id="two-weeks" 
                        checked={formData.releaseDate ? format(formData.releaseDate, "yyyy-MM-dd") === format(addWeeks(new Date(), 2), "yyyy-MM-dd") : false}
                      />
                      <div>
                        <Label htmlFor="two-weeks" className="cursor-pointer font-medium block">Earliest Available (2 Weeks)</Label>
                        <span className="text-xs text-muted-foreground">Recommended for maximum delivery success</span>
                      </div>
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <div 
                        className={cn(
                          "flex items-center justify-between space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors",
                          formData.releaseDate && format(formData.releaseDate, "yyyy-MM-dd") !== format(addWeeks(new Date(), 2), "yyyy-MM-dd") && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="flex items-center space-x-2 w-full">
                          <RadioGroupItem 
                            value="custom" 
                            id="custom-date" 
                            checked={formData.releaseDate ? format(formData.releaseDate, "yyyy-MM-dd") !== format(addWeeks(new Date(), 2), "yyyy-MM-dd") : false}
                          />
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <Label htmlFor="custom-date" className="cursor-pointer font-medium block">Specific Date</Label>
                              <span className="text-xs text-muted-foreground">
                                {formData.releaseDate && format(formData.releaseDate, "yyyy-MM-dd") !== format(addWeeks(new Date(), 2), "yyyy-MM-dd") 
                                  ? format(formData.releaseDate, "PPP") 
                                  : "Choose a custom day"}
                              </span>
                            </div>
                            <CalendarIcon className="h-4 w-4 ml-auto text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={formData.releaseDate}
                        onSelect={(date) => date && setFormData({ ...formData, releaseDate: date })}
                        disabled={(date) => date < new Date() || date > addWeeks(new Date(), 2)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </RadioGroup>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border mt-2">
                  <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Your music will be processed and distributed within <strong className="text-foreground">2 weeks</strong> from submission.
                    {formData.releaseDate && (
                      <span> Estimated live date: <strong className="text-primary">{format(formData.releaseDate, "PPP")}</strong></span>
                    )}
                  </p>
                </div>
              </div>

              {/* Cover Art */}
              <div className="space-y-3">
                <Label htmlFor="coverArt" className="flex items-center gap-2">
                  Cover Art *
                  <span className="text-xs text-muted-foreground font-normal">(Required: minimum 1400 x 1400 pixels)</span>
                </Label>
                <div ref={coverScrollRef} className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  {imagePreview ? (
                    <div className="space-y-4">
                      <img src={imagePreview} alt="Cover preview" className="mx-auto max-w-xs rounded-lg" />
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
                        <p className="text-sm text-primary font-medium">Please re-attach: {previousFileName}</p>
                      )}
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        <Label htmlFor="coverArt" className="cursor-pointer text-primary hover:underline">
                          Click to upload
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">Image must be at least 1400 x 1400 pixels</p>
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

              {/* Audio File */}
              <div className="space-y-3">
                <Label htmlFor="audioFile">Music Audio File *</Label>
                <div ref={audioScrollRef} className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  {formData.audioFile ? (
                    <div className="space-y-4">
                      <Music className="mx-auto h-12 w-12 text-primary" />
                      <p className="text-sm font-medium">{formData.audioFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(formData.audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {isUploadingAudio && (
                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Uploading audio...</span>
                            <span className="font-medium">{audioUploadProgress}%</span>
                          </div>
                          <Progress value={audioUploadProgress} className="h-2" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormData({ ...formData, audioFile: null });
                          sessionStorage.removeItem("pendingAudioFileName");
                          setSavedAudioFileName(null);
                        }}
                        disabled={isUploadingAudio}
                      >
                        Remove File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {showReattachPrompt && savedAudioFileName && (
                        <p className="text-sm text-primary font-medium">Please re-attach: {savedAudioFileName}</p>
                      )}
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        <Label htmlFor="audioFile" className="cursor-pointer text-primary hover:underline">
                          Click to upload
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">Upload MP3, WAV, or other audio formats</p>
                    </div>
                  )}
                  <Input
                    id="audioFile"
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioChange}
                    className="hidden"
                    ref={audioFileRef}
                  />
                </div>
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
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || validatingImage || isUploadingAudio}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving release...
                  </>
                ) : validatingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating image...
                  </>
                ) : (
                  "Save & Continue to Payment"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Your release will be saved as unpaid before you're redirected to payment
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadRelease;
