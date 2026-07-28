DROP POLICY IF EXISTS "notifications insert authenticated" ON public.notifications;
CREATE POLICY "notifications insert by auditors or admins" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moto_responsible')
  );