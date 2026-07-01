-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Backfill username for existing users using email prefix, handling collisions
-- by appending a numeric suffix for duplicates
WITH ranked AS (
  SELECT
    id,
    SPLIT_PART(email, '@', 1) AS base_username,
    ROW_NUMBER() OVER (PARTITION BY SPLIT_PART(email, '@', 1) ORDER BY created_at) AS rn
  FROM public.profiles
  WHERE username IS NULL
)
UPDATE public.profiles p
SET username = CASE
  WHEN r.rn = 1 THEN r.base_username
  ELSE r.base_username || '_' || r.rn
END
FROM ranked r
WHERE p.id = r.id;

-- Create unique index (safe now that collisions are resolved)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Make username NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

-- Function to look up email by username (used for login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email FROM public.profiles WHERE username = p_username;
$$;

-- Function to look up username by email (used for recovery)
CREATE OR REPLACE FUNCTION public.get_username_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT username FROM public.profiles WHERE email = p_email;
$$;

-- Update handle_new_user to include username (preserve search_path for security)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;