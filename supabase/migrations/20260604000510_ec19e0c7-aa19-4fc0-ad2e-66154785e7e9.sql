
ALTER TABLE public.artist_verifications
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS platform_email text,
  ADD COLUMN IF NOT EXISTS platform_user_id text,
  ADD COLUMN IF NOT EXISTS topic_channel_url text,
  ADD COLUMN IF NOT EXISTS distributor_name text;

CREATE UNIQUE INDEX IF NOT EXISTS artist_verifications_user_platform_unique
  ON public.artist_verifications (user_id, platform)
  WHERE platform IS NOT NULL;
