import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { actionUpdateSchema, fieldErrors } from "@/lib/validation";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";

type ActionStatus = "Not started" | "On going" | "Close" | "In delay";

const STATUS_LABEL: Record<string, string> = {
  "Not started": "Non démarrée",
  "On going": "En cours",
  "In delay": "En retard",
  Close: "Clôturée",
};

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Plans d'action correctifs — Yazaki MOTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Plans d'action indisponibles"),
  component: () => (
    <RoleGate
      allowed={["admin", "action_responsible", "department_manager", "moto_responsible"]}
    >
      <ActionsPage />
    </RoleGate>
  ),
});

interface ActionRow {
  id: string;
  issue_description: string;
  status: string;
  department: string | null;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  action_plan: string | null;
  resolution_comment: string | null;
  assigned_to: string | null;
  evidence_url: string | null;
  evidence_correction_url: string | null;
  created_at: string;
  audit_entries: {
    audit_items: { code: number; description: string | null } | null;
    workstations: { name: string } | null;
  } | null;
}

function ActionsPage() {
  const qc = useQueryClient();
  const { roles } = useCurrentUser();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<ActionRow | null>(null);

  const { data: actions, isLoading } = useQuery({
    queryKey: ["actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ng_actions")
        .select(
          "id, issue_description, status, department, priority, start_date, due_date, action_plan, resolution_comment, assigned_to, evidence_url, evidence_correction_url, created_at, audit_entries(audit_items(code, description), workstations(name))",
        )
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as ActionRow[];
    },
  });

  const sorted = useMemo(() => {
    const list = (actions ?? []).filter((a) => filter === "all" || a.status === filter);
    return [...list].sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority ?? "normal"] ?? 2;
      const pb = PRIORITY_WEIGHT[b.priority ?? "normal"] ?? 2;
      if (pa !== pb) return pa - pb;
      const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }, [actions, filter]);

  const kpis = useMemo(() => {
    const list = actions ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const closed = list.filter((a) => a.status === "Close").length;
    const late = list.filter(
      (a) => a.status !== "Close" && a.due_date && a.due_date < today,
    ).length;
    return {
      total: list.length,
      closed,
      late,
      ongoing: list.filter((a) => a.status === "On going").length,
      rate: list.length ? Math.round((closed / list.length) * 100) : 0,
    };
  }, [actions]);

  const updateStatus = useMutation({
    mutationFn: async (p: { id: string; status: ActionStatus }) => {
      const { error } = await supabase
        .from("ng_actions")
        .update({ status: p.status })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible"),
  });

  const isManager = roles.includes("department_manager") || roles.includes("admin");

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-primary shrink-0" /> Plans d'action correctifs
          </h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Supervision des non-conformités et de l'avancement des responsables d'action."
              : "Traitement des non-conformités qui vous sont assignées, par priorité et échéance."}
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="Not started">Non démarrées</SelectItem>
            <SelectItem value="On going">En cours</SelectItem>
            <SelectItem value="In delay">En retard</SelectItem>
            <SelectItem value="Close">Clôturées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Actions totales" value={kpis.total} />
        <Kpi label="En cours" value={kpis.ongoing} />
        <Kpi label="En retard" value={kpis.late} tone="danger" />
        <Kpi label="Taux de clôture" value={`${kpis.rate}%`} tone="ok" />
      </div>

      <div className="grid gap-3">
        {isLoading && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Chargement…</CardContent>
          </Card>
        )}
        {sorted.map((a) => {
          const item = a.audit_entries?.audit_items;
          const ws = a.audit_entries?.workstations;
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-64">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item && <Badge variant="outline">#{item.code}</Badge>}
                      {ws?.name && <Badge variant="secondary">{ws.name}</Badge>}
                      {a.department && <Badge variant="outline">{a.department}</Badge>}
                      <PriorityBadge priority={a.priority} />
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-2 font-medium">{a.issue_description}</div>
                    {a.action_plan && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Plan :</span> {a.action_plan}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground flex gap-4 flex-wrap">
                      <span>Créé : {format(new Date(a.created_at), "dd/MM/yy")}</span>
                      {a.start_date && (
                        <span>Début : {format(new Date(a.start_date), "dd/MM/yy")}</span>
                      )}
                      {a.due_date && (
                        <span>Échéance : {format(new Date(a.due_date), "dd/MM/yy")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={a.status}
                      onValueChange={(v) => {
                        if (v === "Close") {
                          toast.info(
                            "La clôture exige un commentaire et une photo de preuve : ouvrez le rapport NG.",
                          );
                          setEditing(a);
                          return;
                        }
                        updateStatus.mutate({ id: a.id, status: v as ActionStatus });
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not started">Non démarrée</SelectItem>
                        <SelectItem value="On going">En cours</SelectItem>
                        <SelectItem value="In delay">En retard</SelectItem>
                        <SelectItem value="Close">Clôturée</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                      Rapport NG
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && sorted.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Aucune action corrective pour ce filtre.
            </CardContent>
          </Card>
        )}
      </div>

      <EditDialog action={editing} onClose={() => setEditing(null)} />
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

function PriorityBadge({ priority }: { priority: string | null }) {
  const map: Record<string, string> = {
    critical: "Critique",
    high: "Haute",
    normal: "Normale",
    low: "Faible",
  };
  const p = priority ?? "normal";
  if (p === "normal") return null;
  return (
    <Badge variant={p === "critical" || p === "high" ? "destructive" : "outline"}>
      {map[p] ?? p}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Not started": "bg-muted text-foreground",
    "On going": "bg-blue-500 text-white",
    "In delay": "bg-[var(--status-ng)] text-white",
    Close: "bg-[var(--status-ok)] text-white",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${map[status] ?? ""}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function EditDialog({ action, onClose }: { action: ActionRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState("");
  const [comment, setComment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ActionStatus>("Not started");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [evidenceSrc, setEvidenceSrc] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!action) return;
    setPlan(action.action_plan ?? "");
    setComment(action.resolution_comment ?? "");
    setDueDate(action.due_date ?? "");
    setStatus(action.status as ActionStatus);
    setFile(null);
    setEvidenceSrc(null);
    setFormErrors({});
    if (action.evidence_url) {
      void supabase.storage
        .from("audit-evidence")
        .createSignedUrl(action.evidence_url, 3600)
        .then(({ data }) => setEvidenceSrc(data?.signedUrl ?? null));
    }
  }, [action]);

  if (!action) return null;

  async function save() {
    if (!action) return;
    const parsed = actionUpdateSchema.safeParse({
      status,
      actionPlan: plan,
      resolutionComment: comment,
      dueDate: dueDate || "",
      existingClosingEvidence: action.evidence_correction_url,
      closingEvidence: file,
    });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setFormErrors(errs);
      toast.error(Object.values(errs)[0] ?? "Données invalides.");
      return;
    }
    setFormErrors({});
    setBusy(true);
    try {
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
          due_date: dueDate || null,
          evidence_correction_url,
        })
        .eq("id", action.id);
      if (error) throw error;
      toast.success("Rapport NG mis à jour");
      qc.invalidateQueries({ queryKey: ["actions"] });
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rapport de non-conformité</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-muted p-3 rounded">{action.issue_description}</div>
          {evidenceSrc && (
            <div>
              <Label>Preuve constatée (audit)</Label>
              <img
                src={evidenceSrc}
                alt="Preuve de non-conformité"
                className="mt-1 rounded-md border max-h-56 object-contain"
              />
            </div>
          )}
          <div>
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ActionStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not started">Non démarrée</SelectItem>
                <SelectItem value="On going">En cours</SelectItem>
                <SelectItem value="In delay">En retard</SelectItem>
                <SelectItem value="Close">Clôturée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plan d'action</Label>
            <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Commentaire de réalisation</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            {formErrors.resolutionComment && (
              <p className="mt-1 text-xs font-medium text-destructive">
                {formErrors.resolutionComment}
              </p>
            )}
          </div>
          <div>
            <Label>Échéance</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <Label>
              Preuve après correction
              {status === "Close" && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {action.evidence_correction_url && !file && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Une preuve de correction est déjà enregistrée.
              </p>
            )}
            {formErrors.closingEvidence && (
              <p className="mt-1 text-xs font-medium text-destructive">
                {formErrors.closingEvidence}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={busy}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}