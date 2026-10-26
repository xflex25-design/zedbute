-- Remove the (placeholder) followers_count column from playlists
ALTER TABLE public.playlists DROP COLUMN IF EXISTS followers_count;
