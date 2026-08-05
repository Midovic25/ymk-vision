import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, Inbox, Save } from "lucide-react";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";
import { useCurrentUser } from "@/hooks/use-current-user";
import { actionUpdateSchema, fieldErrors } from "@/lib/validation";
import { ACTION_STATUS_LABEL_FR, type ActionStatus } from "@/types/domain";

export const Route = createFileRoute("/_authenticated/my-actions")({
  head: () => ({
    meta: [
      { title: "Mes actions correctives — Yazaki MOTO" },
      {
        name: "description",
        content:
          "Espace de réception et de traitement des actions correctives MOTO assignées au responsable d'action.",
      },
      { property: "og:title", content: "Mes actions correctives — Yazaki MOTO" },
      {
        property: "og:description",
        content: "Traitement des non-conformités assignées : preuve photo, statut et clôture.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Espace responsable d'action indisponible"),
  component: () => (
    <RoleGate allowed={["action_responsible"]}>
      <MyActionsPage />
    </RoleGate>
  ),
});

const STATUSES: ActionStatus[] = ["Not started", "On going", "In delay", "Close"];

function MyActionsPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: actions, isLoading } = useQuery({
    queryKey: ["my-actions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ng_actions")
        .select(
          "id, issue_description, action_plan, resolution_comment, status, priority, department, start_date, due_date, created_at, evidence_url, evidence_correction_url",
        )
        .eq("assigned_to", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Priorisation métier : criticité décroissante, puis échéance la plus proche.
  const PRIORITY_RANK: Record<string, number> = {
    critique: 0,
    critical: 0,
    haute: 1,
    high: 1,
    normal: 2,
    normale: 2,
    basse: 3,
    low: 3,
  };

  const filtered = useMemo(
    () =>
      (actions ?? [])
        .filter((a) => statusFilter === "all" || a.status === statusFilter)
        .sort((a, b) => {
          const pa = PRIORITY_RANK[(a.priority ?? "normal").toLowerCase()] ?? 2;
          const pb = PRIORITY_RANK[(b.priority ?? "normal").toLowerCase()] ?? 2;
          if (pa !== pb) return pa - pb;
          const da = a.due_date ?? "9999-12-31";
          const db = b.due_date ?? "9999-12-31";
          if (da !== db) return da < db ? -1 : 1;
          return a.created_at < b.created_at ? 1 : -1;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions, statusFilter],
  );

  const selected = useMemo(
    () => (actions ?? []).find((a) => a.id === selectedId) ?? null,
    [actions, selectedId],
  );

  const open = (actions ?? []).filter((a) => a.status !== "Close").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="text-primary" /> Mes actions correctives
        </h1>
        <p className="text-sm text-muted-foreground">
          Plan d'action généré par les auditeurs MOTO et assigné à votre périmètre —{" "}
          {open} action(s) ouverte(s) sur {actions?.length ?? 0}.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-52">
            <Label className="text-xs uppercase tracking-wider">Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ACTION_STATUS_LABEL_FR[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-72 flex-1">
            <Label className="text-xs uppercase tracking-wider">Action à traiter</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une action…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {filtered.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.issue_description.slice(0, 70)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <TreatmentPanel
          action={selected}
          onSaved={() => qc.invalidateQueries({ queryKey: ["my-actions"] })}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions reçues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.issue_description}</span>
                  <span className="text-xs text-muted-foreground">
                    Échéance : {a.due_date ?? "à définir"}
                  </span>
                </span>
                <Badge variant="outline">
                  {ACTION_STATUS_LABEL_FR[a.status as ActionStatus] ?? a.status}
                </Badge>
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Aucune action ne vous est assignée pour ce filtre.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type ActionRow = {
  id: string;
  issue_description: string;
  action_plan: string | null;
  resolution_comment: string | null;
  status: string;
  due_date: string | null;
  start_date: string | null;
  created_at: string;
  evidence_url: string | null;
  evidence_correction_url: string | null;
};

function TreatmentPanel({
  action,
  onSaved,
}: {
  action: ActionRow;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState(action.action_plan ?? "");
  const [comment, setComment] = useState(action.resolution_comment ?? "");
  const [status, setStatus] = useState<ActionStatus>(action.status as ActionStatus);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [evidenceSrc, setEvidenceSrc] = useState<string | null>(null);

  useEffect(() => {
    setPlan(action.action_plan ?? "");
    setComment(action.resolution_comment ?? "");
    setStatus(action.status as ActionStatus);
    setFile(null);
    setErrors({});
    setEvidenceSrc(null);
    if (action.evidence_url) {
      void supabase.storage
        .from("audit-evidence")
        .createSignedUrl(action.evidence_url, 3600)
        .then(({ data }) => setEvidenceSrc(data?.signedUrl ?? null));
    }
  }, [action]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = actionUpdateSchema.safeParse({
        status,
        actionPlan: plan,
        resolutionComment: comment,
        dueDate: action.due_date ?? "",
        existingClosingEvidence: action.evidence_correction_url,
        closingEvidence: file,
      });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error(Object.values(fieldErrors(parsed.error))[0] ?? "Données invalides.");
      }
      setErrors({});
      let evidence_correction_url = action.evidence_correction_url;
      if (file) {
        const path = `corrections/${action.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("audit-evidence")
          .upload(path, file);
        if (upErr) throw upErr;
        evidence_correction_url = path;
      }
      const { error } = await supabase
        .from("ng_actions")
        .update({
          action_plan: plan,
          resolution_comment: comment,
          status,
          evidence_correction_url,
        })
        .eq("id", action.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Action mise à jour");
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Traitement de l'action</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 rounded-md bg-muted p-3 text-sm">
          {action.issue_description}
        </div>

        <div>
          <Label>Date d'ouverture (générée à la clôture de l'audit)</Label>
          <Input value={action.start_date ?? action.created_at.slice(0, 10)} disabled />
        </div>
        <div>
          <Label>Échéance</Label>
          <Input value={action.due_date ?? "à définir"} disabled />
        </div>

        {evidenceSrc && (
          <div className="md:col-span-2">
            <Label>Preuve constatée en audit</Label>
            <img
              src={evidenceSrc}
              alt="Preuve de la non-conformité relevée en audit"
              className="mt-1 max-h-56 rounded-md border object-contain"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <Label>Plan d'action</Label>
          <Textarea rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <Label>Commentaire de réalisation</Label>
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {errors.resolutionComment && (
            <p className="mt-1 text-xs text-destructive">{errors.resolutionComment}</p>
          )}
        </div>

        <div>
          <Label>Preuve après correction (photo) *</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Camera className="h-5 w-5 text-muted-foreground" />
          </div>
          {action.evidence_correction_url && !file && (
            <p className="mt-1 text-xs text-muted-foreground">Une preuve est déjà enregistrée.</p>
          )}
          {errors.closingEvidence && (
            <p className="mt-1 text-xs text-destructive">{errors.closingEvidence}</p>
          )}
        </div>

        <div>
          <Label>Statut</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ActionStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ACTION_STATUS_LABEL_FR[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-1 h-4 w-4" /> Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}