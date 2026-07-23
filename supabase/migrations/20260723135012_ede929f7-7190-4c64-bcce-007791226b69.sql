
CREATE POLICY "audit-evidence read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='audit-evidence');
CREATE POLICY "audit-evidence upload auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='audit-evidence');
CREATE POLICY "audit-evidence update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='audit-evidence' AND owner=auth.uid());
CREATE POLICY "audit-evidence delete own or admin" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='audit-evidence' AND (owner=auth.uid() OR public.has_role(auth.uid(),'admin')));
