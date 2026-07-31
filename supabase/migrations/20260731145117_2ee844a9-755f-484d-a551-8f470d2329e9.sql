-- 1. Approval helper
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.approved = true)
$$;

-- 2. Stop auto-granting the auditor role on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, approved)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- 3. Remove auto-granted auditor roles from accounts that were never approved
DELETE FROM public.user_roles ur
WHERE ur.role = 'moto_responsible'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id AND p.approved = true
  );

-- 4. Gate all write paths on approval
DROP POLICY IF EXISTS "audits insert own" ON public.audits;
CREATE POLICY "audits insert own" ON public.audits
FOR INSERT TO authenticated
WITH CHECK (auditor_id = auth.uid() AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "audits update own or admin" ON public.audits;
CREATE POLICY "audits update own or admin" ON public.audits
FOR UPDATE TO authenticated
USING (
  public.is_approved(auth.uid())
  AND (auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  public.is_approved(auth.uid())
  AND (auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "entries manage own audit" ON public.audit_entries;
CREATE POLICY "entries insert own audit" ON public.audit_entries
FOR INSERT TO authenticated
WITH CHECK (
  public.is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id = audit_entries.audit_id
      AND (a.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "entries update own audit" ON public.audit_entries
FOR UPDATE TO authenticated
USING (
  public.is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id = audit_entries.audit_id
      AND (a.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  public.is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id = audit_entries.audit_id
      AND (a.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "entries delete own audit" ON public.audit_entries
FOR DELETE TO authenticated
USING (
  public.is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id = audit_entries.audit_id
      AND (a.auditor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "actions insert" ON public.ng_actions;
CREATE POLICY "actions insert" ON public.ng_actions
FOR INSERT TO authenticated
WITH CHECK (
  public.is_approved(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.audit_entries e
    JOIN public.audits a ON a.id = e.audit_id
    WHERE e.id = ng_actions.entry_id
      AND (
        a.auditor_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'action_responsible')
      )
  )
);

DROP POLICY IF EXISTS "actions update" ON public.ng_actions;
CREATE POLICY "actions update" ON public.ng_actions
FOR UPDATE TO authenticated
USING (
  public.is_approved(auth.uid())
  AND (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'action_responsible')
  )
)
WITH CHECK (
  public.is_approved(auth.uid())
  AND (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'action_responsible')
  )
);

DROP POLICY IF EXISTS "notifications insert by auditors or admins" ON public.notifications;
CREATE POLICY "notifications insert by auditors or admins" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  public.is_approved(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moto_responsible')
  )
);

-- 5. Internal helpers must not be directly callable through the API
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evidence_audit_id(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_evidence(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_audit(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_action_responsible(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon, authenticated;