-- Create release_tracks table for multiple songs per release
CREATE TABLE IF NOT EXISTS public.release_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid REFERENCES public.music_releases(id) ON DELETE CASCADE NOT NULL,
  track_number integer NOT NULL,
  title text NOT NULL,
  audio_url text,
  duration_seconds integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.release_tracks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view tracks of their releases"
ON public.release_tracks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.music_releases
    WHERE music_releases.id = release_tracks.release_id
    AND music_releases.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tracks for their releases"
ON public.release_tracks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.music_releases
    WHERE music_releases.id = release_tracks.release_id
    AND music_releases.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tracks of their releases"
ON public.release_tracks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.music_releases
    WHERE music_releases.id = release_tracks.release_id
    AND music_releases.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tracks of their releases"
ON public.release_tracks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.music_releases
    WHERE music_releases.id = release_tracks.release_id
    AND music_releases.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_release_tracks_updated_at
BEFORE UPDATE ON public.release_tracks
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();