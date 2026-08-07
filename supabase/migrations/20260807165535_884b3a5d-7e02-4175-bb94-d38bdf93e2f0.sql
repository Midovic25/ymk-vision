ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_email text;

CREATE OR REPLACE FUNCTION private.list_action_responsibles()
RETURNS TABLE (id uuid, full_name text, email text, department text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, COALESCE(p.notify_email, p.email), p.department
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'action_responsible'
  WHERE p.approved
  ORDER BY p.full_name NULLS LAST
$$;

CREATE OR REPLACE FUNCTION public.list_action_responsibles()
RETURNS TABLE (id uuid, full_name text, email text, department text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT * FROM private.list_action_responsibles() $$;

REVOKE ALL ON FUNCTION private.list_action_responsibles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_action_responsibles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_action_responsibles() TO authenticated;