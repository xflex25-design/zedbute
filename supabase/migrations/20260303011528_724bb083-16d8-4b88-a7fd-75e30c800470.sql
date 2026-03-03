-- Add public SELECT policy for audio-files bucket
CREATE POLICY "Anyone can view audio files"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-files');