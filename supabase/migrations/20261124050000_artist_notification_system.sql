-- Migration: 20261124050000_artist_notification_system.sql
-- Description: Establishes complete notification infrastructure for release status updates (approvals, rejections, deliveries) and payment confirmations.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Ensure columns exist if table was already created
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Create indexes for fast artist dashboard queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  CREATE POLICY "Users view own notifications"
    ON public.notifications FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own notifications"
    ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage all notifications"
    ON public.notifications FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
