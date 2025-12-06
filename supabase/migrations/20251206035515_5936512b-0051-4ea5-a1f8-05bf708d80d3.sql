-- Drop the existing check constraint and recreate with 'pending' included
ALTER TABLE public.music_releases DROP CONSTRAINT music_releases_status_check;

ALTER TABLE public.music_releases ADD CONSTRAINT music_releases_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'processing'::text, 'distributed'::text, 'failed'::text]));