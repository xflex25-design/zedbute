-- ============================================================
-- Add cover_image and description to playlists
-- ============================================================

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS cover_image text;

-- Refresh seed for new installs (existing installs should run the
-- manual UPDATE queries provided in the playlist update docs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.playlists) THEN
    INSERT INTO public.playlists (name, genre, description, submission_fee, cover_image, is_active) VALUES
      (
        'Zambia''s Finest',
        'Hip-Hop · Afrobeats',
        'The hottest tracks from Zambia''s top artists. Pure energy, pure talent. From Lusaka to the world.',
        40,
        'https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260712-WA0071(1).jpg',
        true
      ),
      (
        'Afro Gold',
        'Afrobeat · Amapiano',
        'Your daily dose of chart-topping Afrobeat and Amapiano. Certified bangers only. Keep the vibe alive.',
        35,
        'https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260712-WA0069(1).jpg',
        true
      ),
      (
        'Street Code',
        'Hip-Hop · Drill · Trap',
        'Raw, unfiltered underground sounds. For the streets, by the streets. No cap, just heat.',
        30,
        'https://focothurmwepjqbyrtnn.supabase.co/storage/v1/object/public/cover-art/IMG-20260712-WA0069(1).jpg',
        true
      );
  END IF;
END $$;
