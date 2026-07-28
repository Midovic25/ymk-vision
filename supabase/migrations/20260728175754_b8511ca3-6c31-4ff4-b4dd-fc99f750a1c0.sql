
-- Helper: can the current user see a given audit?
CREATE OR REPLACE FUNCTION public.can_view_audit(_audit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.audits a
    WHERE a.id = _audit_id AND a.auditor_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'department_manager')
  OR EXISTS (
    SELECT 1 FROM public.ng_actions n
    JOIN public.audit_entries e ON e.id = n.entry_id
    WHERE e.audit_id = _audit_id AND n.assigned_to = auth.uid()
  )
$$;

-- audits
DROP POLICY IF EXISTS "audits read all auth" ON public.audits;
CREATE POLICY "audits read scoped" ON public.audits FOR SELECT TO authenticated
USING (public.can_view_audit(id));

-- audit_entries
DROP POLICY IF EXISTS "entries read" ON public.audit_entries;
CREATE POLICY "entries read scoped" ON public.audit_entries FOR SELECT TO authenticated
USING (public.can_view_audit(audit_id));

-- ng_actions
DROP POLICY IF EXISTS "actions read" ON public.ng_actions;
CREATE POLICY "actions read scoped" ON public.ng_actions FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'department_manager')
  OR EXISTS (
    SELECT 1 FROM public.audit_entries e
    JOIN public.audits a ON a.id = e.audit_id
    WHERE e.id = ng_actions.entry_id AND a.auditor_id = auth.uid()
  )
);

-- profiles
DROP POLICY IF EXISTS "profiles read all auth" ON public.profiles;
CREATE POLICY "profiles read scoped" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'department_manager')
  OR public.has_role(auth.uid(), 'moto_responsible')
);

-- Storage evidence scoping ------------------------------------------------
CREATE OR REPLACE FUNCTION public.evidence_audit_id(_path text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seg text;
  res uuid;
BEGIN
  IF split_part(_path, '/', 1) = 'corrections' THEN
    seg := split_part(_path, '/', 2);
    IF seg !~ '^[0-9a-fA-F-]{36}$' THEN RETURN NULL; END IF;
    SELECT a.id INTO res
    FROM public.ng_actions n
    JOIN public.audit_entries e ON e.id = n.entry_id
    JOIN public.audits a ON a.id = e.audit_id
    WHERE n.id = seg::uuid;
  ELSE
    seg := split_part(_path, '/', 1);
    IF seg !~ '^[0-9a-fA-F-]{36}$' THEN RETURN NULL; END IF;
    SELECT a.id INTO res
    FROM public.audit_entries e
    JOIN public.audits a ON a.id = e.audit_id
    WHERE e.id = seg::uuid;
  END IF;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_evidence(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_view_audit(public.evidence_audit_id(_path))
$$;

DROP POLICY IF EXISTS "audit-evidence read auth" ON storage.objects;
CREATE POLICY "audit-evidence read scoped" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'audit-evidence' AND public.can_access_evidence(name));

DROP POLICY IF EXISTS "audit-evidence upload auth" ON storage.objects;
CREATE POLICY "audit-evidence upload scoped" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audit-evidence'
  AND owner = auth.uid()
  AND public.can_access_evidence(name)
);

-- Internal SECURITY DEFINER helpers must not be callable directly by clients
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.can_view_audit(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.evidence_audit_id(text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.can_access_evidence(text) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
