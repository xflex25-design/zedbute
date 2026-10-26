-- Spotify artist profile claims
CREATE TABLE IF NOT EXISTS public.spotify_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  spotify_link text,
  distributor text,
  notes text,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid')),
  payment_transaction_id text,
  payment_amount numeric(12,2),
  claim_status text DEFAULT 'New' CHECK (claim_status IN ('New', 'Instructions Sent', 'Awaiting Verification', 'Claimed', 'Rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.spotify_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own spotify claims"
    ON public.spotify_claims FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users create own spotify claims"
    ON public.spotify_claims FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own spotify claims"
    ON public.spotify_claims FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage all spotify claims"
    ON public.spotify_claims FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER spotify_claims_updated_at
  BEFORE UPDATE ON public.spotify_claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
