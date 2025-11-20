-- Create storage bucket for cover art
INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-art', 'cover-art', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for cover art bucket
CREATE POLICY "Users can upload their own cover art"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view cover art"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cover-art');

CREATE POLICY "Users can update their own cover art"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own cover art"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cover-art' AND auth.uid()::text = (storage.foldername(name))[1]);