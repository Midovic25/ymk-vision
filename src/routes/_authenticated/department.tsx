import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";
import { normalizeCorporateEmail } from "@/lib/validation";
import { ACTION_STATUS_LABEL_FR, type ActionStatus } from "@/types/domain";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/department")({
  head: () => ({
    meta: [
      { title: "Pilotage département — Yazaki MOTO" },
      {
        name: "description",
        content:
          "Tableau de bord analytique du département : avancement des plans d'action et performance des responsables.",
      },
      { property: "og:title", content: "Pilotage département — Yazaki MOTO" },
      {
        property: "og:description",
        content: "Suivi analytique des plans d'action MOTO par responsable.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Pilotage département indisponible"),
  component: () => (
    <RoleGate allowed={["department_manager"]}>
      <DepartmentPage />
    </RoleGate>
  ),
});

const STATUS_ORDER: ActionStatus[] = ["Not started", "On going", "In delay", "Close"];
const STATUS_COLOR: Record<ActionStatus, string> = {
  "Not started": "var(--status-na)",
  "On going": "#2563eb",
  "In delay": "var(--status-ng)",
  Close: "var(--status-ok)",
};

function DepartmentPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["department-actions"],
    queryFn: async () => {
      const { data: actions, error } = await supabase
        .from("ng_actions")
        .select(
          "id, status, priority, due_date, created_at, department, issue_description, assigned_to",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = Array.from(
        new Set((actions ?? []).map((a) => a.assigned_to).filter((x): x is string => !!x)),
      );
      const profiles = ids.length
        ? ((
            await supabase.from("profiles").select("id, full_name, email").in("id", ids)
          ).data ?? [])
        : [];
      const byId = new Map(profiles.map((p) => [p.id, p]));
      return { actions: actions ?? [], byId };
    },
  });

  const actions = data?.actions ?? [];

  const statusData = useMemo(
    () =>
      STATUS_ORDER.map((s) => ({
        name: ACTION_STATUS_LABEL_FR[s],
        status: s,
        value: actions.filter((a) => a.status === s).length,
      })),
    [actions],
  );

  const perResponsible = useMemo(() => {
    const m = new Map<
      string,
      { name: string; total: number; closed: number; late: number; ongoing: number }
    >();
    for (const a of actions) {
      const key = a.assigned_to ?? "unassigned";
      const p = data?.byId.get(key);
      const name =
        p?.full_name ?? normalizeCorporateEmail(p?.email) ?? "Non assigné";
      const row =
        m.get(key) ?? { name: name || "Non assigné", total: 0, closed: 0, late: 0, ongoing: 0 };
      row.total += 1;
      if (a.status === "Close") row.closed += 1;
      if (a.status === "In delay") row.late += 1;
      if (a.status === "On going") row.ongoing += 1;
      m.set(key, row);
    }
    return Array.from(m.values())
      .map((r) => ({ ...r, rate: r.total ? Math.round((r.closed / r.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [actions, data]);

  const total = actions.length;
  const closed = actions.filter((a) => a.status === "Close").length;
  const late = actions.filter((a) => a.status === "In delay").length;
  const rate = total ? Math.round((closed / total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="text-primary" /> Pilotage du département
        </h1>
        <p className="text-sm text-muted-foreground">
          Analyse des plans d'action issus des audits MOTO et performance comparée des
          responsables d'action.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Actions totales" value={total} />
        <Kpi label="Clôturées" value={closed} tone="ok" />
        <Kpi label="En retard" value={late} tone="danger" />
        <Kpi label="Taux de clôture" value={`${rate}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
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
            <CardTitle className="text-base">
              Comparatif des responsables d'action
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perResponsible}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={50} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="closed" name="Clôturées" fill="var(--status-ok)" stackId="a" />
                <Bar dataKey="ongoing" name="En cours" fill="#2563eb" stackId="a" />
                <Bar dataKey="late" name="En retard" fill="var(--status-ng)" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan d'action global du département</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Non-conformité</th>
                <th className="px-3 py-2">Responsable</th>
                <th className="px-3 py-2">Département</th>
                <th className="px-3 py-2">Échéance</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const p = a.assigned_to ? data?.byId.get(a.assigned_to) : null;
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2 max-w-md truncate">{a.issue_description}</td>
                    <td className="px-3 py-2">
                      {p?.full_name ?? normalizeCorporateEmail(p?.email) ?? "Non assigné"}
                    </td>
                    <td className="px-3 py-2">{a.department ?? "—"}</td>
                    <td className="px-3 py-2">{a.due_date ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge
                        style={{
                          backgroundColor: STATUS_COLOR[a.status as ActionStatus],
                          color: "white",
                        }}
                      >
                        {ACTION_STATUS_LABEL_FR[a.status as ActionStatus] ?? a.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && actions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Aucune action corrective enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "danger";
}) {
  const color =
    tone === "ok"
      ? "text-[var(--status-ok)]"
      : tone === "danger"
        ? "text-[var(--status-ng)]"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}