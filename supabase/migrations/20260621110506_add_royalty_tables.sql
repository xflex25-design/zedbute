
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  isrc text UNIQUE,
  genre text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'flagged')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.royalty_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date_earned date DEFAULT now() NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'paid', 'disputed')),
  source text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  bank_name text NOT NULL,
  bank_account_number text NOT NULL,
  bank_code text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  requested_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  CREATE INDEX idx_songs_artist_id ON public.songs(artist_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_royalty_records_user_id ON public.royalty_records(user_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_royalty_records_song_id ON public.royalty_records(song_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_royalty_records_status_date ON public.royalty_records(status, date_earned);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests(status);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own songs" ON public.songs FOR SELECT TO authenticated USING (auth.uid() = artist_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own songs" ON public.songs FOR INSERT TO authenticated WITH CHECK (auth.uid() = artist_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own songs" ON public.songs FOR UPDATE TO authenticated USING (auth.uid() = artist_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users view own royalties" ON public.royalty_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins insert royalties" ON public.royalty_records FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins update royalties" ON public.royalty_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users create own withdrawals" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS songs_updated_at ON public.songs;
DROP TRIGGER IF EXISTS royalty_records_updated_at ON public.royalty_records;
DROP TRIGGER IF EXISTS withdrawal_requests_updated_at ON public.withdrawal_requests;

CREATE TRIGGER songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER royalty_records_updated_at BEFORE UPDATE ON public.royalty_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
