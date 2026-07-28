
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_audit_id(text) TO authenticated;
