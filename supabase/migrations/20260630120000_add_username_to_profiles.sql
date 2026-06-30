-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Backfill username for existing users using email prefix
UPDATE public.profiles
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;

-- Make username NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

-- Function to look up email by username (used for login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM public.profiles WHERE username = p_username;
$$;

-- Function to look up username by email (used for recovery)
CREATE OR REPLACE FUNCTION public.get_username_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT username FROM public.profiles WHERE email = p_email;
$$;

-- Update handle_new_user to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
