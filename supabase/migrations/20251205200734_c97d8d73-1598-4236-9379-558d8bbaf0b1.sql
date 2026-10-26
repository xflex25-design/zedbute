-- Add storage policies for cover-art bucket
CREATE POLICY "Users can upload cover art"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view cover art"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cover-art');

CREATE POLICY "Users can update own cover art"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own cover art"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add storage policies for audio-files bucket
CREATE POLICY "Users can upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own audio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);