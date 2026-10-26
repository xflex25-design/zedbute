-- Create payments table
CREATE TABLE public.release_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  phone_number text NOT NULL,
  transaction_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  verified_at timestamp with time zone,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.release_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
ON public.release_payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own payment records
CREATE POLICY "Users can create own payments"
ON public.release_payments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_release_payments_updated_at
BEFORE UPDATE ON public.release_payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update artist_verifications to track payment
ALTER TABLE public.artist_verifications
ADD COLUMN IF NOT EXISTS payment_transaction_id text,
ADD COLUMN IF NOT EXISTS payment_phone_number text;