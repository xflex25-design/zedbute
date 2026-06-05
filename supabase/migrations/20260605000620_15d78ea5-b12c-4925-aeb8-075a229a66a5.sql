
CREATE POLICY "users upload own verification screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verification-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users read own verification screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verification-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admins read all verification screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verification-screenshots' AND public.has_role(auth.uid(), 'admin'));
