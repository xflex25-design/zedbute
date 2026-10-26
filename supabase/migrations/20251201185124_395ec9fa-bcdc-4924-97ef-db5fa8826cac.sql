-- Add phone_number column to profiles table
ALTER TABLE public.profiles
ADD COLUMN phone_number text;

-- Add a comment to describe the column
COMMENT ON COLUMN public.profiles.phone_number IS 'User phone number for authentication and contact purposes';