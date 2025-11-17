-- Create profiles table for user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  artist_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create artist verification table
CREATE TABLE IF NOT EXISTS public.artist_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  artist_name text NOT NULL,
  youtube_url text,
  instagram_url text,
  tiktok_url text,
  spotify_url text,
  soundcloud_url text,
  twitter_url text,
  facebook_url text,
  website_url text,
  bio text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  deposit_amount numeric DEFAULT 0,
  submission_date timestamptz DEFAULT now() NOT NULL,
  review_date timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.artist_verifications ENABLE ROW LEVEL SECURITY;

-- Artist verifications policies
CREATE POLICY "Users can view own verification"
  ON public.artist_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification"
  ON public.artist_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verification"
  ON public.artist_verifications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Create music releases table
CREATE TABLE IF NOT EXISTS public.music_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  artist_name text NOT NULL,
  release_date date,
  genre text,
  cover_art_url text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'distributed', 'failed')),
  distribution_platforms jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.music_releases ENABLE ROW LEVEL SECURITY;

-- Music releases policies
CREATE POLICY "Users can view own releases"
  ON public.music_releases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create releases"
  ON public.music_releases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own releases"
  ON public.music_releases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own releases"
  ON public.music_releases FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_artist_verifications_updated_at
  BEFORE UPDATE ON public.artist_verifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_music_releases_updated_at
  BEFORE UPDATE ON public.music_releases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();