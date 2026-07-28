
CREATE OR REPLACE FUNCTION public.is_action_responsible(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'action_responsible')
$$;
REVOKE ALL ON FUNCTION public.is_action_responsible(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_action_responsible(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles read scoped" ON public.profiles;
CREATE POLICY "profiles read scoped" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'department_manager')
  OR (public.has_role(auth.uid(), 'moto_responsible') AND public.is_action_responsible(id))
);
