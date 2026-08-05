import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";
import { normalizeCorporateEmail } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activité des utilisateurs — Yazaki MOTO" },
      {
        name: "description",
        content:
          "Tableau de bord administrateur de l'activité par profil : auditeurs MOTO, responsables d'action et responsables de département.",
      },
      { property: "og:title", content: "Activité des utilisateurs — Yazaki MOTO" },
      {
        property: "og:description",
        content: "Suivi de l'activité par type de profil sur la plateforme MOTO.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Activité des utilisateurs indisponible"),
  component: () => (
    <RoleGate allowed={["admin"]}>
      <ActivityPage />
    </RoleGate>
  ),
});

const ROLE_COLORS = ["#E60012", "#2563eb", "#16a34a", "#f59e0b"];

function ActivityPage() {
  const { data } = useQuery({
    queryKey: ["user-activity"],
    queryFn: async () => {
      const [profilesRes, rolesRes, auditsRes, actionsRes, notifRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, approved"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("audits").select("id, auditor_id, status, score, audit_date"),
        supabase.from("ng_actions").select("id, assigned_to, status, created_at"),
        supabase.from("notifications").select("id, user_id, created_at"),
      ]);
      return {
        profiles: profilesRes.data ?? [],
        roles: rolesRes.data ?? [],
        audits: auditsRes.data ?? [],
        actions: actionsRes.data ?? [],
        notifications: notifRes.data ?? [],
      };
    },
  });

  const nameOf = useMemo(() => {
    const m = new Map((data?.profiles ?? []).map((p) => [p.id, p]));
    return (id: string | null) => {
      if (!id) return "Non assigné";
      const p = m.get(id);
      return p?.full_name ?? normalizeCorporateEmail(p?.email) ?? "Utilisateur";
    };
  }, [data]);

  const roleDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data?.roles ?? []) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
    return [
      { name: "Administrateurs", value: counts.get("admin") ?? 0 },
      { name: "Auditeurs MOTO", value: counts.get("moto_responsible") ?? 0 },
      { name: "Resp. département", value: counts.get("department_manager") ?? 0 },
      { name: "Resp. d'action", value: counts.get("action_responsible") ?? 0 },
    ];
  }, [data]);

  const auditors = useMemo(() => {
    const m = new Map<string, { name: string; total: number; closed: number }>();
    for (const a of data?.audits ?? []) {
      const row = m.get(a.auditor_id) ?? { name: nameOf(a.auditor_id), total: 0, closed: 0 };
      row.total += 1;
      if (a.status === "closed") row.closed += 1;
      m.set(a.auditor_id, row);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [data, nameOf]);

  const responsibles = useMemo(() => {
    const m = new Map<
      string,
      { name: string; total: number; closed: number; ongoing: number; late: number }
    >();
    for (const a of data?.actions ?? []) {
      const key = a.assigned_to ?? "unassigned";
      const row =
        m.get(key) ??
        { name: nameOf(a.assigned_to), total: 0, closed: 0, ongoing: 0, late: 0 };
      row.total += 1;
      if (a.status === "Close") row.closed += 1;
      if (a.status === "On going") row.ongoing += 1;
      if (a.status === "In delay") row.late += 1;
      m.set(key, row);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [data, nameOf]);

  const managers = useMemo(() => {
    const ids = (data?.roles ?? [])
      .filter((r) => r.role === "department_manager")
      .map((r) => r.user_id);
    const notifs = data?.notifications ?? [];
    return ids.map((id) => ({
      name: nameOf(id),
      supervised: responsibles.length,
      notifications: notifs.filter((n) => n.user_id === id).length,
    }));
  }, [data, nameOf, responsibles]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Activity className="text-primary" /> Activité des utilisateurs
        </h1>
        <p className="text-sm text-muted-foreground">
          Suivi consolidé par type de profil : auditeurs MOTO, responsables d'action et
          responsables de département.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Comptes" value={data?.profiles.length ?? 0} />
        <Kpi label="Audits réalisés" value={data?.audits.length ?? 0} />
        <Kpi label="Actions correctives" value={data?.actions.length ?? 0} />
        <Kpi label="Notifications émises" value={data?.notifications.length ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des habilitations</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleDistribution} dataKey="value" nameKey="name" outerRadius={90} label>
                  {roleDistribution.map((d, i) => (
                    <Cell key={d.name} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activité des auditeurs MOTO</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={auditors}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={50} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Audits lancés" fill="#2563eb" />
                <Bar dataKey="closed" name="Audits clôturés" fill="var(--status-ok)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité des responsables d'action</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={responsibles}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={60} angle={-15} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="closed" name="Clôturées" stackId="a" fill="var(--status-ok)" />
              <Bar dataKey="ongoing" name="En cours" stackId="a" fill="#2563eb" />
              <Bar dataKey="late" name="En retard" stackId="a" fill="var(--status-ng)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Responsables de département</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Responsable</th>
                  <th className="px-3 py-2">Responsables d'action supervisés</th>
                  <th className="px-3 py-2">Notifications reçues</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.name} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2">{m.supervised}</td>
                    <td className="px-3 py-2">{m.notifications}</td>
                  </tr>
                ))}
                {managers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Aucun responsable de département habilité.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}