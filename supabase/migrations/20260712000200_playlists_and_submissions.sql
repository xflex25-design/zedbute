-- ============================================================
-- Submit to Playlist feature
-- ============================================================

-- Curated Zedbute playlists (managed from admin panel)
CREATE TABLE IF NOT EXISTS public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  genre text,
  submission_fee numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Artist submissions to one or more playlists
CREATE TABLE IF NOT EXISTS public.playlist_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_title text NOT NULL,
  artist_name text NOT NULL,
  release_link text NOT NULL,
  curator_message text,
  payment_batch_id uuid,
  payment_status text DEFAULT 'pending_payment'
    CHECK (payment_status IN ('pending_payment', 'paid', 'failed')),
  review_status text DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'changes_requested')),
  admin_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- In-app notifications (artist status changes, etc.)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Playlists: public read, admin manage
DO $$ BEGIN
  CREATE POLICY "Anyone can view active playlists"
    ON public.playlists FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage playlists"
    ON public.playlists FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Submissions: artist views/creates own, admin manages all
DO $$ BEGIN
  CREATE POLICY "Artists view own playlist submissions"
    ON public.playlist_submissions FOR SELECT TO authenticated
    USING (auth.uid() = artist_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Artists create own playlist submissions"
    ON public.playlist_submissions FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = artist_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage all playlist submissions"
    ON public.playlist_submissions FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications: recipient views own, edge functions (service role) insert
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

-- updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER playlists_updated_at
    BEFORE UPDATE ON public.playlists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER playlist_submissions_updated_at
    BEFORE UPDATE ON public.playlist_submissions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed a few example playlists so the feature is usable immediately.
-- (Idempotent: only inserts if the table is empty.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.playlists) THEN
    INSERT INTO public.playlists (name, genre, submission_fee) VALUES
      ('Afro Hits Zambia', 'Afrobeat', 30),
      ('Hip Hop Zambia', 'Hip Hop', 30),
      ('Zedbute Top 50', 'Mixed', 30),
      ('African Vibes', 'Afrobeats', 30);
  END IF;
END $$;
