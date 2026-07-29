import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/audit/")({
  head: () => ({
    meta: [
      { title: "Audits MOTO — Yazaki YMK" },
      { name: "description", content: "Liste et démarrage d'audits MOTO." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditList,
});

function AuditList() {
  const { data: audits, isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audits")
        .select("id, audit_date, status, score, plant, lines(name)")
        .order("audit_date", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audits MOTO</h1>
          <p className="text-sm text-muted-foreground">
            Historique de conformité et lancement d'un nouvel audit terrain.
          </p>
        </div>
        <Button asChild>
          <Link to="/audit/new">
            <Plus className="h-4 w-4 mr-1" /> Démarrer un audit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-muted-foreground">Chargement...</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Usine</th>
                  <th className="py-2 px-3">Ligne</th>
                  <th className="py-2 px-3">Statut</th>
                  <th className="py-2 px-3">Score</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {audits?.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-3">
                      {format(new Date(a.audit_date), "dd/MM/yyyy")}
                    </td>
                    <td className="py-2 px-3">{a.plant ?? "YMK"}</td>
                    <td className="py-2 px-3 font-medium">
                      {(a.lines as { name: string } | null)?.name}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={a.status === "closed" ? "secondary" : "default"}>
                        {a.status === "closed" ? "Clôturé" : "Brouillon"}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 font-bold">
                      {a.score != null ? `${a.score}%` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/audit/$id" params={{ id: a.id }}>
                          Ouvrir →
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!isLoading && (audits?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Aucun audit pour le moment.
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