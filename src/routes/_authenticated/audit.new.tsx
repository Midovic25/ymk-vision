import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardList, ArrowLeft } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/_authenticated/audit/new")({
  head: () => ({
    meta: [
      { title: "Configuration d'audit — Yazaki MOTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Configuration d'audit indisponible"),
  component: () => (
    <RoleGate allowed={["admin", "moto_responsible"]}>
      <NewAuditPage />
    </RoleGate>
  ),
});

function NewAuditPage() {
  const navigate = useNavigate();
  const { user, profile } = useCurrentUser();
  const [plant, setPlant] = useState("YMK");
  const [lineId, setLineId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [pillar, setPillar] = useState("all");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: lines } = useQuery({
    queryKey: ["lines"],
    queryFn: async () => {
      const { data } = await supabase.from("lines").select("id, name").order("name");
      return data ?? [];
    },
  });

  // Zones réellement présentes sur la ligne choisie
  const { data: lineWorkstations } = useQuery({
    queryKey: ["line-ws", lineId],
    enabled: !!lineId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workstations")
        .select("id, name, area_id, pillar_id, areas(name), pillars(name)")
        .eq("line_id", lineId)
        .order("name");
      return data ?? [];
    },
  });

  const areas = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of lineWorkstations ?? []) {
      const name = (w.areas as { name: string } | null)?.name;
      if (w.area_id && name) m.set(w.area_id, name);
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [lineWorkstations]);

  const pillars = useMemo(() => {
    const s = new Set<string>();
    for (const w of lineWorkstations ?? []) {
      if (areaId && w.area_id !== areaId) continue;
      const name = (w.pillars as { name: string } | null)?.name;
      if (name) s.add(name);
    }
    return Array.from(s).sort();
  }, [lineWorkstations, areaId]);

  const scopedWs = (lineWorkstations ?? []).filter((w) => !areaId || w.area_id === areaId);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Session expirée");
      if (!lineId) throw new Error("Sélectionnez une ligne de production");
      const { data, error } = await supabase
        .from("audits")
        .insert({
          line_id: lineId,
          auditor_id: user.id,
          audit_date: date,
          plant,
          area_id: areaId || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (a) =>
      navigate({
        to: "/audit/$id",
        params: { id: a.id },
        search: pillar === "all" ? {} : { pillar },
      }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Création impossible"),
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/audit">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="text-primary" /> Configuration de l'audit MOTO
        </h1>
        <p className="text-sm text-muted-foreground">
          Définissez le périmètre : usine, ligne de production, secteur et date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Usine / Plant</Label>
            <Select value={plant} onValueChange={setPlant}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="YMK">YMK — Kenitra</SelectItem>
                <SelectItem value="YBEY">YBEY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date de l'audit</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Auditeur</Label>
            <Input value={profile?.full_name ?? user?.email ?? ""} disabled />
          </div>
          <div>
            <Label>Département</Label>
            <Input value={profile?.department ?? "—"} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Périmètre hiérarchique</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Ligne de production *</Label>
            <Select
              value={lineId}
              onValueChange={(v) => {
                setLineId(v);
                setAreaId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une ligne…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {lines?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Secteur / Zone (Area)</Label>
            <Select value={areaId} onValueChange={setAreaId} disabled={!lineId}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les zones" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Pilier MOTO à auditer</Label>
            <Select value={pillar} onValueChange={setPillar} disabled={!lineId}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les piliers" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Tous les piliers</SelectItem>
                {pillars.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="font-semibold mb-1">Périmètre sélectionné</div>
            <div className="text-muted-foreground">
              {lineId
                ? `${scopedWs.length} poste(s) de travail · ${pillars.length} pilier(s) : ${
                    pillars.join(", ") || "—"
                  }`
                : "Sélectionnez une ligne de production pour voir les postes et piliers."}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link to="/audit">Annuler</Link>
        </Button>
        <Button onClick={() => create.mutate()} disabled={!lineId || create.isPending}>
          Lancer la grille d'audit
        </Button>
      </div>
    </div>
  );
}
