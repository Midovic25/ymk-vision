DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own or admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notifications read own or admin" ON public.notifications;
CREATE POLICY "notifications read scoped" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'department_manager')
    OR public.has_role(auth.uid(), 'moto_responsible')
  );