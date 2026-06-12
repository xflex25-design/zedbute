import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function MusicReleaseForm() {
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("music_releases").insert([
      {
        user_id: user?.id,
        title,
        release_date: releaseDate,
      },
    ]);

    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: "Success", description: "Release created!" });
      setTitle("");
      setReleaseDate("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Release Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="releaseDate">Release Date</Label>
        <Input
          id="releaseDate"
          type="date"
          value={releaseDate}
          onChange={(e) => setReleaseDate(e.target.value)}
          required
        />
      </div>

      <Button type="submit">Create Release</Button>
    </form>
  );
}
