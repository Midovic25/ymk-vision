DELETE FROM public.audits WHERE auditor_id='a2c8d987-ad95-4ba5-bff7-9fa5106736bb' AND status='open' AND id NOT IN (SELECT audit_id FROM public.audit_entries);

DROP POLICY IF EXISTS "audits read scoped" ON public.audits;
CREATE POLICY "audits read scoped" ON public.audits FOR SELECT TO authenticated
USING (auditor_id = auth.uid() OR public.can_view_audit(id));

DROP POLICY IF EXISTS "entries read scoped" ON public.audit_entries;
CREATE POLICY "entries read scoped" ON public.audit_entries FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.audits a WHERE a.id = audit_entries.audit_id AND a.auditor_id = auth.uid())
  OR public.can_view_audit(audit_id)
);