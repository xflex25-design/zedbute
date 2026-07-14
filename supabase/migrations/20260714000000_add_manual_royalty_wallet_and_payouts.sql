-- ============================================================
-- Manual royalty wallet + mobile money payout requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artist_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_earned numeric(14,2) NOT NULL DEFAULT 0.00,
  current_balance numeric(14,2) NOT NULL DEFAULT 0.00,
  total_withdrawn numeric(14,2) NOT NULL DEFAULT 0.00,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('MTN_MOMO', 'AIRTEL_MONEY')),
  phone_number text NOT NULL,
  account_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
DO $$ BEGIN
  CREATE INDEX idx_artist_royalties_user_id ON public.artist_royalties(user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_payout_requests_user_id ON public.payout_requests(user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_payout_requests_status ON public.payout_requests(status);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX idx_payout_requests_created_at ON public.payout_requests(created_at DESC);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS
ALTER TABLE public.artist_royalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- artist_royalties policies
DO $$ BEGIN
  CREATE POLICY "Users view own wallet"
    ON public.artist_royalties
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage wallets"
    ON public.artist_royalties
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payout_requests policies
DO $$ BEGIN
  CREATE POLICY "Users view own payouts"
    ON public.payout_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own payouts"
    ON public.payout_requests
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage payouts"
    ON public.payout_requests
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers
DROP TRIGGER IF EXISTS artist_royalties_updated_at ON public.artist_royalties;
DROP TRIGGER IF EXISTS payout_requests_updated_at ON public.payout_requests;

CREATE TRIGGER artist_royalties_updated_at
  BEFORE UPDATE ON public.artist_royalties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- Safe RPC: complete a payout request and update wallet atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_payout_request(
  p_payout_request_id uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS TABLE(
  payout_request_id uuid,
  new_status text,
  new_balance numeric,
  new_total_withdrawn numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.payout_requests;
  v_wallet public.artist_royalties;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can complete payout requests';
  END IF;

  SELECT * INTO v_request FROM public.payout_requests WHERE id = p_payout_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Payout request is not pending';
  END IF;

  IF p_rejection_reason IS NOT NULL THEN
    UPDATE public.payout_requests
    SET status = 'rejected',
        rejection_reason = p_rejection_reason,
        updated_at = now()
    WHERE id = p_payout_request_id
    RETURNING * INTO v_request;

    RETURN QUERY SELECT v_request.id, v_request.status, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  SELECT * INTO v_wallet FROM public.artist_royalties WHERE user_id = v_request.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artist wallet not found';
  END IF;

  IF v_wallet.current_balance < v_request.amount THEN
    RAISE EXCEPTION 'Insufficient balance for payout';
  END IF;

  UPDATE public.artist_royalties
  SET current_balance = current_balance - v_request.amount,
      total_withdrawn = total_withdrawn + v_request.amount,
      updated_at = now()
  WHERE user_id = v_request.user_id
  RETURNING current_balance, total_withdrawn INTO v_wallet.current_balance, v_wallet.total_withdrawn;

  UPDATE public.payout_requests
  SET status = 'completed',
      updated_at = now()
  WHERE id = p_payout_request_id
  RETURNING * INTO v_request;

  RETURN QUERY SELECT v_request.id, v_request.status, v_wallet.current_balance, v_wallet.total_withdrawn;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_payout_request(uuid, text) TO authenticated;
