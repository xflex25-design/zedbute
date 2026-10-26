-- Allow NULL phone_number for non-mobile-money payments (e.g. Stripe card)
ALTER TABLE public.release_payments
  ALTER COLUMN phone_number DROP NOT NULL;
