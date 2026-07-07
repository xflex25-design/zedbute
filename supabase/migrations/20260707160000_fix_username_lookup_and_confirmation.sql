-- Make username lookup case-insensitive and whitespace-safe, and store a
-- normalized username on signup so login never fails on casing/whitespace.
-- The lookup stays SECURITY DEFINER so it bypasses RLS (anon callers can't
-- read profiles directly, but the RPC can).

-- Lookup by username: normalize both sides with lower(trim(...)).
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email FROM public.profiles
  WHERE lower(btrim(username)) = lower(btrim(p_username));
$$;

-- Recovery lookup by email (kept consistent).
CREATE OR REPLACE FUNCTION public.get_username_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT username FROM public.profiles
  WHERE lower(btrim(email)) = lower(btrim(p_email));
$$;

-- Store a normalized (lower + trimmed) username on new signups so the
-- stored value always matches what the login lookup produces.
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
    lower(btrim(COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    )))
  );
  RETURN NEW;
END;
$$;
