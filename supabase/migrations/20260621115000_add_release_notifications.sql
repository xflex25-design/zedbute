
ALTER TABLE public.music_releases
  ADD COLUMN IF NOT EXISTS distributed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_music_releases_notification 
  ON public.music_releases(user_id, distributed_at, notification_sent) 
  WHERE notification_sent = false AND distributed_at IS NOT NULL;
