-- Spotify artist profile claims (mirrors spotify_claims + new identity fields)
-- Safe to re-run: creates the table if missing, then adds the new columns
-- if the table already existed with the older schema.
CREATE TABLE IF NOT EXISTS public.spotify_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  spotify_link text,
  distributor text,
  notes text,
  country_code text,
  mobile_number text,
  email_code text,
  email_verified boolean DEFAULT false,
  social_platform text,
  social_profile_link text,
  social_proof_file text,
  label_proof_file text,
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

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER spotify_claims_updated_at
    BEFORE UPDATE ON public.spotify_claims
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add the identity-proof / contact columns if the table already exists
-- (without these, the ALTER above is a no-op since the table was just created).
ALTER TABLE public.spotify_claims
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS email_code text,
  ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_platform text,
  ADD COLUMN IF NOT EXISTS social_profile_link text,
  ADD COLUMN IF NOT EXISTS social_proof_file text,
  ADD COLUMN IF NOT EXISTS label_proof_file text;
