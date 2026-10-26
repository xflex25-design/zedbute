-- Add audio_url column to music_releases table
ALTER TABLE public.music_releases 
ADD COLUMN audio_url text;

-- Create audio-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false);

-- RLS policies for audio-files bucket
CREATE POLICY "Users can view their own audio files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own audio files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own audio files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);