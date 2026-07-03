-- Add producer_name and legal_name fields to music_releases table
ALTER TABLE music_releases 
ADD COLUMN IF NOT EXISTS producer_name TEXT,
ADD COLUMN IF NOT EXISTS legal_name TEXT;