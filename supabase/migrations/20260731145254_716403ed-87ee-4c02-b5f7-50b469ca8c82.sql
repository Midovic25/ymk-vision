CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Privileged implementations, outside the exposed API schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END
$$;

CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.approved = true)
$$;

CREATE OR REPLACE FUNCTION private.is_action_responsible(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'action_responsible')
$$;

CREATE OR REPLACE FUNCTION private.can_view_audit(_audit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.audits a WHERE a.id = _audit_id AND a.auditor_id = auth.uid()
  )
  OR private.has_role(auth.uid(), 'admin')
  OR private.has_role(auth.uid(), 'department_manager')
  OR EXISTS (
    SELECT 1 FROM public.ng_actions n
    JOIN public.audit_entries e ON e.id = n.entry_id
    WHERE e.audit_id = _audit_id AND n.assigned_to = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.evidence_audit_id(_path text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE seg text; res uuid;
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
END; $$;

CREATE OR REPLACE FUNCTION private.can_access_evidence(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT private.can_view_audit(private.evidence_audit_id(_path))
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM public;
REVOKE ALL ON FUNCTION private.is_approved(uuid) FROM public;
REVOKE ALL ON FUNCTION private.is_action_responsible(uuid) FROM public;
REVOKE ALL ON FUNCTION private.can_view_audit(uuid) FROM public;
REVOKE ALL ON FUNCTION private.evidence_audit_id(text) FROM public;
REVOKE ALL ON FUNCTION private.can_access_evidence(text) FROM public;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_action_responsible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.evidence_audit_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_evidence(text) TO authenticated;

-- Public-schema functions become non-privileged wrappers used by the policies
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.is_approved(_user_id) $$;

CREATE OR REPLACE FUNCTION public.is_action_responsible(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.is_action_responsible(_user_id) $$;

CREATE OR REPLACE FUNCTION public.can_view_audit(_audit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.can_view_audit(_audit_id) $$;

CREATE OR REPLACE FUNCTION public.evidence_audit_id(_path text)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.evidence_audit_id(_path) $$;

CREATE OR REPLACE FUNCTION public.can_access_evidence(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT private.can_access_evidence(_path) $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_action_responsible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_audit_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_evidence(text) TO authenticated;