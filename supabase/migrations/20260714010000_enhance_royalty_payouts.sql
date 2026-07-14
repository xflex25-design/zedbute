-- ============================================================
-- Enhancements to the manual royalty wallet + payout system
--   1. Validate Zambian mobile money phone numbers at the DB level
--   2. Secure admin RPC to credit an artist's wallet (used because
--      all stream calculations / royalty payouts arrive to the admin first)
-- ============================================================

-- 1. Zambian phone number validator
--    Accepts: +260971234567 | 0971234567 | 971234567 (and 9x / 7x prefixes)
CREATE OR REPLACE FUNCTION public.is_valid_zambian_phone(phone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN phone IS NOT NULL AND phone ~ '^(?:\+260|0)?(7[1-9]|9[5-7])\d{7}$';
END;
$$;

-- Enforce the rule on every stored payout request (new rows going forward)
DO $$ BEGIN
  ALTER TABLE public.payout_requests
    DROP CONSTRAINT IF EXISTS payout_requests_phone_check;
  ALTER TABLE public.payout_requests
    ADD CONSTRAINT payout_requests_phone_check
    CHECK (public.is_valid_zambian_phone(phone_number));
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. Secure admin-only RPC to credit an artist's wallet.
--    Creates the wallet row if it does not exist yet, then atomically adds
--    the amount to both total_earned and current_balance.
--    Artists cannot call this (SECURITY DEFINER + admin role check), so they
--    can never inflate their own balance.
CREATE OR REPLACE FUNCTION public.admin_credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_note text DEFAULT NULL
)
RETURNS TABLE(
  wallet_id uuid,
  new_total_earned numeric,
  new_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.artist_royalties;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can credit wallets';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be greater than 0';
  END IF;

  -- Ensure the artist has a wallet row (one per user)
  INSERT INTO public.artist_royalties (user_id, total_earned, current_balance, total_withdrawn)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.artist_royalties
  SET total_earned = total_earned + p_amount,
      current_balance = current_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING id, total_earned, current_balance
    INTO v_wallet.id, v_wallet.total_earned, v_wallet.current_balance;

  RETURN QUERY SELECT v_wallet.id, v_wallet.total_earned, v_wallet.current_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_credit_wallet(uuid, numeric, text) TO authenticated;
