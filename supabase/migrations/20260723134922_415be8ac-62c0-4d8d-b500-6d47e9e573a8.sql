
CREATE TYPE public.app_role AS ENUM ('admin','moto_responsible','action_responsible','department_manager');
CREATE TYPE public.audit_status AS ENUM ('open','closed');
CREATE TYPE public.entry_status AS ENUM ('OK','NG','NA');
CREATE TYPE public.action_status AS ENUM ('Not started','On going','Close','In delay');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, email TEXT, department TEXT, line_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL, UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE POLICY "roles read own or admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles insert admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles delete admin" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles update admin" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.lines (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT ON public.lines TO authenticated; GRANT ALL ON public.lines TO service_role;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lines read" ON public.lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "lines admin" ON public.lines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pillars (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE);
GRANT SELECT ON public.pillars TO authenticated; GRANT ALL ON public.pillars TO service_role;
ALTER TABLE public.pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pillars read" ON public.pillars FOR SELECT TO authenticated USING (true);
CREATE POLICY "pillars admin" ON public.pillars FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.areas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE);
GRANT SELECT ON public.areas TO authenticated; GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas read" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas admin" ON public.areas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audit_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code INT NOT NULL UNIQUE, description TEXT, pillar_id UUID REFERENCES public.pillars(id));
GRANT SELECT ON public.audit_items TO authenticated; GRANT ALL ON public.audit_items TO service_role;
ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read" ON public.audit_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items admin" ON public.audit_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.workstations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.areas(id),
  pillar_id UUID NOT NULL REFERENCES public.pillars(id),
  name TEXT NOT NULL, UNIQUE(line_id, area_id, pillar_id, name)
);
CREATE INDEX ON public.workstations(line_id);
GRANT SELECT ON public.workstations TO authenticated; GRANT ALL ON public.workstations TO service_role;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws read" ON public.workstations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws admin" ON public.workstations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.workstation_items (
  workstation_id UUID NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.audit_items(id) ON DELETE CASCADE,
  PRIMARY KEY(workstation_id, item_id)
);
CREATE INDEX ON public.workstation_items(item_id);
GRANT SELECT ON public.workstation_items TO authenticated; GRANT ALL ON public.workstation_items TO service_role;
ALTER TABLE public.workstation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wsi read" ON public.workstation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "wsi admin" ON public.workstation_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES public.lines(id),
  auditor_id UUID NOT NULL REFERENCES auth.users(id),
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.audit_status NOT NULL DEFAULT 'open',
  score NUMERIC(5,2), closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audits(auditor_id);
CREATE INDEX ON public.audits(line_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated; GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audits read all auth" ON public.audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "audits insert own" ON public.audits FOR INSERT TO authenticated WITH CHECK (auditor_id=auth.uid());
CREATE POLICY "audits update own or admin" ON public.audits FOR UPDATE TO authenticated USING (auditor_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "audits delete admin" ON public.audits FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  workstation_id UUID NOT NULL REFERENCES public.workstations(id),
  item_id UUID NOT NULL REFERENCES public.audit_items(id),
  status public.entry_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(audit_id, workstation_id, item_id)
);
CREATE INDEX ON public.audit_entries(audit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_entries TO authenticated; GRANT ALL ON public.audit_entries TO service_role;
ALTER TABLE public.audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries read" ON public.audit_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "entries manage own audit" ON public.audit_entries FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.audits a WHERE a.id=audit_id AND (a.auditor_id=auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS(SELECT 1 FROM public.audits a WHERE a.id=audit_id AND (a.auditor_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.ng_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.audit_entries(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas(id),
  department TEXT, issue_description TEXT NOT NULL, evidence_url TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  action_plan TEXT, due_date DATE, evidence_correction_url TEXT,
  status public.action_status NOT NULL DEFAULT 'Not started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entry_id)
);
CREATE INDEX ON public.ng_actions(assigned_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ng_actions TO authenticated; GRANT ALL ON public.ng_actions TO service_role;
ALTER TABLE public.ng_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions read" ON public.ng_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "actions insert" ON public.ng_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.audit_entries e JOIN public.audits a ON a.id=e.audit_id WHERE e.id=entry_id AND (a.auditor_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'action_responsible'))));
CREATE POLICY "actions update" ON public.ng_actions FOR UPDATE TO authenticated USING (assigned_to=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'action_responsible'));
CREATE POLICY "actions delete admin" ON public.ng_actions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_ng_actions_updated BEFORE UPDATE ON public.ng_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'moto_responsible') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
