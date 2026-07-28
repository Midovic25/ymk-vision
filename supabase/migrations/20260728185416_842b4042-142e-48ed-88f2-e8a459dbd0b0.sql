DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM public.profiles WHERE email IN ('admin@yazaki.com','auditor@yazaki.com','action@yazaki.com','manager@yazaki.com')
);

INSERT INTO public.user_roles (user_id, role)
SELECT p.id,
  CASE p.email
    WHEN 'admin@yazaki.com' THEN 'admin'::app_role
    WHEN 'auditor@yazaki.com' THEN 'moto_responsible'::app_role
    WHEN 'action@yazaki.com' THEN 'action_responsible'::app_role
    ELSE 'department_manager'::app_role
  END
FROM public.profiles p
WHERE p.email IN ('admin@yazaki.com','auditor@yazaki.com','action@yazaki.com','manager@yazaki.com')
ON CONFLICT DO NOTHING;

UPDATE public.profiles
SET approved = true, approved_at = now(), department = COALESCE(department, 'Production')
WHERE email IN ('admin@yazaki.com','auditor@yazaki.com','action@yazaki.com','manager@yazaki.com');