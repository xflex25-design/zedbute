-- Add unique constraint and indexes for release_tracks
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_tracks_release_number_unique
  ON public.release_tracks (release_id, track_number);

CREATE INDEX IF NOT EXISTS idx_release_tracks_release_id
  ON public.release_tracks (release_id);
