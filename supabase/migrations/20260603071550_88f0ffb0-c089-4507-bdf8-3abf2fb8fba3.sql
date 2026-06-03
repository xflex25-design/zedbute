
CREATE OR REPLACE FUNCTION public.enforce_verification_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.release_payments
    WHERE user_id = NEW.user_id
      AND status = 'verified'
      AND transaction_id ILIKE 'verification-%'
  ) THEN
    RAISE EXCEPTION 'Verification payment required before submitting application';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_verification_payment_trigger ON public.artist_verifications;
CREATE TRIGGER enforce_verification_payment_trigger
BEFORE INSERT ON public.artist_verifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_payment();
