import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Music, AlertCircle } from "lucide-react";
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
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() => {
    const saved = sessionStorage.getItem("uploadFormData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.selectedLanguages || [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [hasValidPayment, setHasValidPayment] = useState<boolean | null>(null);
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("uploadFormData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          title: parsed.title || "",
          releaseType: parsed.releaseType || "single",
          genre: parsed.genre || "",
          coverArt: null as File | null,
          audioFile: null as File | null,
          rightsConfirmed: parsed.rightsConfirmed || false,
        };
      } catch {
        return {
          title: "",
          releaseType: "single",
          genre: "",
          coverArt: null as File | null,
          audioFile: null as File | null,
          rightsConfirmed: false,
        };
      }
    }
    return {
      title: "",
      releaseType: "single",
      genre: "",
      coverArt: null as File | null,
      audioFile: null as File | null,
      rightsConfirmed: false,
    };
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    
    // Check for valid payment
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const { data: payments } = await supabase
      .from("release_payments")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "verified")
      .gte("created_at", startOfYear);
    
    if (payments && payments.length > 0) {
      setHasValidPayment(true);
    } else {
      // Allow form filling without payment - payment required on submit
      setHasValidPayment(false);
    }
  };

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const isValid = img.width === 3000 && img.height === 3000;
        if (!isValid) {
          toast({
            title: "Invalid Image Dimensions",
            description: "Cover art must be exactly 3000x3000 pixels",
            variant: "destructive",
          });
        }
        resolve(isValid);
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
      return;
    }

    const isValid = await validateImage(file);
    if (isValid) {
      setFormData({ ...formData, coverArt: file });
      setImagePreview(URL.createObjectURL(file));
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
      toast({
        title: "Missing Title",
        description: "Please enter a release title",
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

    if (!formData.coverArt) {
      toast({
        title: "No Cover Art",
        description: "Please upload cover art (3000x3000 pixels)",
        variant: "destructive",
      });
      return;
    }

    if (!formData.audioFile) {
      toast({
        title: "No Audio File",
        description: "Please upload your music audio file",
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

    // Check if payment is required
    if (!hasValidPayment) {
      // Save form metadata to sessionStorage before redirecting to payment
      sessionStorage.setItem("uploadFormData", JSON.stringify({
        title: formData.title,
        releaseType: formData.releaseType,
        genre: formData.genre,
        rightsConfirmed: formData.rightsConfirmed,
        selectedLanguages,
      }));
      toast({
        title: "Payment Required",
        description: "Please complete payment to upload your release.",
      });
      navigate("/payment?type=release");
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload cover art to storage
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

      // Upload audio file to storage with progress tracking
      setIsUploadingAudio(true);
      setAudioUploadProgress(0);
      
      const audioExt = formData.audioFile!.name.split(".").pop();
      const audioFileName = `${user.id}/${Date.now()}.${audioExt}`;
      
      // Simulate progress for audio upload
      const progressInterval = setInterval(() => {
        setAudioUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      const { error: audioUploadError } = await supabase.storage
        .from("audio-files")
        .upload(audioFileName, formData.audioFile!);

      clearInterval(progressInterval);
      
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

      // Insert release data
      const { error: insertError } = await supabase
        .from("music_releases")
        .insert({
          user_id: user.id,
          title: formData.title,
          artist_name: user.email || "Artist",
          language: selectedLanguages,
          release_type: formData.releaseType,
          genre: formData.genre,
          cover_art_url: publicUrl,
          audio_url: audioUrl,
          rights_confirmed: formData.rightsConfirmed,
          status: "pending",
        } as any);

      if (insertError) throw insertError;

      setUploadProgress(100);

      // Clear saved form data
      sessionStorage.removeItem("uploadFormData");

      toast({
        title: "Release Submitted Successfully",
        description: "Your release is now pending review. This will take up to 2 weeks.",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
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
    }
  };

  if (!user || hasValidPayment === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-6 w-6" />
              Upload Music Release
            </CardTitle>
            <CardDescription>
              Submit your music for distribution to Boomplay and Spotify. Processing takes up to 2 weeks.
            </CardDescription>
            {!hasValidPayment && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Payment required (K399). Fill out the form and you'll be redirected to payment on submit.
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <FormProgress
              steps={[
                { label: "Title", completed: formData.title.trim().length > 0 },
                { label: "Language", completed: selectedLanguages.length > 0 },
                { label: "Release Type", completed: !!formData.releaseType },
                { label: "Genre", completed: !!formData.genre },
                { label: "Cover Art", completed: !!formData.coverArt },
                { label: "Audio File", completed: !!formData.audioFile },
                { label: "Rights Confirmed", completed: formData.rightsConfirmed },
              ]}
            />
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    <Label htmlFor="single" className="cursor-pointer font-normal">
                      Single
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ep" id="ep" />
                    <Label htmlFor="ep" className="cursor-pointer font-normal">
                      EP
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="album" id="album" />
                    <Label htmlFor="album" className="cursor-pointer font-normal">
                      Album
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Genre */}
              <div className="space-y-2">
                <Label htmlFor="genre">Genre *</Label>
                <select
                  id="genre"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Select a genre</option>
                  {GENRES.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cover Art */}
              <div className="space-y-3">
                <Label htmlFor="coverArt">Cover Art (3000x3000 pixels) *</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
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
                        }}
                      >
                        Remove Image
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                        Image must be exactly 3000x3000 pixels
                      </p>
                    </div>
                  )}
                  <Input
                    id="coverArt"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Audio File */}
              <div className="space-y-3">
                <Label htmlFor="audioFile">Music Audio File *</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  {formData.audioFile ? (
                    <div className="space-y-4">
                      <Music className="mx-auto h-12 w-12 text-primary" />
                      <p className="text-sm font-medium">{formData.audioFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(formData.audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      
                      {/* Audio Upload Progress */}
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
                        }}
                        disabled={isUploadingAudio}
                      >
                        Remove File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        <Label
                          htmlFor="audioFile"
                          className="cursor-pointer text-primary hover:underline"
                        >
                          Click to upload
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload MP3, WAV, or other audio formats
                      </p>
                    </div>
                  )}
                  <Input
                    id="audioFile"
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioChange}
                    className="hidden"
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : hasValidPayment ? (
                  "Submit Release"
                ) : (
                  "Continue to Payment"
                )}
              </Button>
              {!hasValidPayment && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  You'll be redirected to complete payment after form validation
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadRelease;
