import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/audit")({
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedLine, setSelectedLine] = useState<string>("");

  const { data: lines } = useQuery({
    queryKey: ["lines"],
    queryFn: async () => {
      const { data } = await supabase.from("lines").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: audits, isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audits")
        .select("id, audit_date, status, score, lines(name)")
        .order("audit_date", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const createAudit = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      if (!selectedLine) throw new Error("Sélectionnez une ligne");
      const { data, error } = await supabase
        .from("audits")
        .insert({ line_id: selectedLine, auditor_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["audits"] });
      navigate({ to: "/audit/$id", params: { id: a.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audits MOTO</h1>
          <p className="text-sm text-muted-foreground">Historique et lancement d'audit.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvel audit</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-64">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Ligne de production
            </label>
            <Select value={selectedLine} onValueChange={setSelectedLine}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une ligne..." />
              </SelectTrigger>
              <SelectContent>
                {lines?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => createAudit.mutate()} disabled={createAudit.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Démarrer audit
          </Button>
        </CardContent>
      </Card>

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
                    <td className="py-2 px-3 font-medium">
                      {(a as any).lines?.name}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={a.status === "closed" ? "secondary" : "default"}>
                        {a.status}
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
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
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