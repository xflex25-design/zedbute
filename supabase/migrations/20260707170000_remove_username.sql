-- Remove the username concept entirely: auth now uses email + password (or Google).
-- Drop the lookup RPCs, stop writing username in handle_new_user, and drop the column.

DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);
DROP FUNCTION IF EXISTS public.get_username_by_email(TEXT);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS username;
