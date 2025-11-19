-- Add new columns to music_releases table for detailed release information
ALTER TABLE music_releases 
ADD COLUMN IF NOT EXISTS language text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS release_type text CHECK (release_type IN ('single', 'ep', 'album')),
ADD COLUMN IF NOT EXISTS rights_confirmed boolean DEFAULT false;

COMMENT ON COLUMN music_releases.language IS 'Array of languages for the release';
COMMENT ON COLUMN music_releases.release_type IS 'Type of release: single, ep, or album';
COMMENT ON COLUMN music_releases.rights_confirmed IS 'Confirmation that user owns rights to the music';