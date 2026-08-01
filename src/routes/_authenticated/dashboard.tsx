import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { ClipboardList, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard MOTO — Yazaki YMK" },
      { name: "description", content: "Vue synthétique des audits MOTO YMK Kenitra." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Tableau de bord indisponible"),
  component: () => (
    <RoleGate allowed={["admin", "department_manager", "moto_responsible"]}>
      <Dashboard />
    </RoleGate>
  ),
});

function Dashboard() {
  const { data: kpi } = useQuery({
    queryKey: ["kpi"],
    queryFn: async () => {
      const [audits, ng, actions, entries] = await Promise.all([
        supabase.from("audits").select("id", { count: "exact", head: true }),
        supabase
          .from("audit_entries")
          .select("id", { count: "exact", head: true })
          .eq("status", "NG"),
        supabase.from("ng_actions").select("id, status", { count: "exact" }),
        supabase.from("audit_entries").select("status"),
      ]);
      const total = entries.data?.length ?? 0;
      const ok = entries.data?.filter((e) => e.status === "OK").length ?? 0;
      return {
        totalAudits: audits.count ?? 0,
        totalNG: ng.count ?? 0,
        openActions: actions.data?.filter((a) => a.status !== "Close").length ?? 0,
        score: total ? Math.round((ok / total) * 1000) / 10 : 0,
      };
    },
  });

  const { data: byLine } = useQuery({
    queryKey: ["dash-by-line"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audits")
        .select("score, lines(name)")
        .not("score", "is", null)
        .limit(200);
      const agg = new Map<string, { total: number; count: number }>();
      for (const r of data ?? []) {
        const name = (r as any).lines?.name ?? "?";
        const s = agg.get(name) ?? { total: 0, count: 0 };
        s.total += Number(r.score ?? 0);
        s.count += 1;
        agg.set(name, s);
      }
      return Array.from(agg.entries())
        .map(([name, v]) => ({ name, score: Math.round((v.total / v.count) * 10) / 10 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    },
  });

  const { data: byStatus } = useQuery({
    queryKey: ["dash-by-status"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_entries").select("status");
      const counts = { OK: 0, NG: 0, NA: 0 };
      for (const e of data ?? []) counts[e.status as keyof typeof counts]++;
      return [
        { name: "OK", value: counts.OK, color: "oklch(0.68 0.15 155)" },
        { name: "NG", value: counts.NG, color: "oklch(0.58 0.22 27)" },
        { name: "NA", value: counts.NA, color: "oklch(0.72 0.16 65)" },
      ];
    },
  });

  const { data: trend } = useQuery({
    queryKey: ["dash-trend"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audits")
        .select("audit_date, score")
        .not("score", "is", null)
        .order("audit_date")
        .limit(60);
      const agg = new Map<string, { total: number; count: number }>();
      for (const r of data ?? []) {
        const d = r.audit_date;
        const s = agg.get(d) ?? { total: 0, count: 0 };
        s.total += Number(r.score);
        s.count += 1;
        agg.set(d, s);
      }
      return Array.from(agg.entries()).map(([date, v]) => ({
        date,
        score: Math.round((v.total / v.count) * 10) / 10,
      }));
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord MOTO</h1>
        <p className="text-sm text-muted-foreground">
          Synthèse temps réel de la conformité qualité — YMK Kenitra.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={ClipboardList} label="Audits réalisés" value={kpi?.totalAudits ?? "—"} />
        <Kpi
          icon={CheckCircle2}
          label="Score global"
          value={kpi ? `${kpi.score}%` : "—"}
          accent="ok"
        />
        <Kpi icon={AlertTriangle} label="NG détectés" value={kpi?.totalNG ?? "—"} accent="ng" />
        <Kpi
          icon={TrendingUp}
          label="Actions ouvertes"
          value={kpi?.openActions ?? "—"}
          accent="na"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Score moyen par ligne (Top 12)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byLine ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="oklch(0.58 0.22 27)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition OK / NG / NA</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
                  {(byStatus ?? []).map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tendance du score global</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="oklch(0.58 0.22 27)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: "ok" | "ng" | "na";
}) {
  const color =
    accent === "ok"
      ? "text-[var(--status-ok)]"
      : accent === "ng"
        ? "text-[var(--status-ng)]"
        : accent === "na"
          ? "text-[var(--status-na)]"
          : "text-primary";
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
          <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
        </div>
        <Icon className={`h-8 w-8 ${color} opacity-80`} />
      </CardContent>
    </Card>
  );
}
