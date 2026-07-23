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
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

type ActionStatus = "Not started" | "On going" | "Close" | "In delay";

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Actions correctives — Yazaki MOTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActionsPage,
});

function ActionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any>(null);

  const { data: actions } = useQuery({
    queryKey: ["actions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ng_actions")
        .select(
          "id, issue_description, status, department, due_date, action_plan, evidence_url, evidence_correction_url, created_at, audit_entries(audit_id, audit_items(code, description), workstations(name))",
        )
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = actions?.filter((a) => filter === "all" || a.status === filter) ?? [];

  const updateStatus = useMutation({
    mutationFn: async (p: { id: string; status: ActionStatus }) => {
      const { error } = await supabase
        .from("ng_actions")
        .update({ status: p.status })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions"] }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-primary" /> Actions correctives
          </h1>
          <p className="text-sm text-muted-foreground">
            Suivi des non-conformités et plans d'action.
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
            <SelectItem value="Close">Fermées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filtered.map((a) => {
          const item = (a as any).audit_entries?.audit_items;
          const ws = (a as any).audit_entries?.workstations;
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-64">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">#{item?.code}</Badge>
                      {ws?.name && <Badge variant="secondary">{ws.name}</Badge>}
                      {a.department && <Badge variant="outline">{a.department}</Badge>}
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-2 font-medium">{a.issue_description}</div>
                    {a.action_plan && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Plan:</span> {a.action_plan}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                      <span>Créé: {format(new Date(a.created_at), "dd/MM/yy")}</span>
                      {a.due_date && (
                        <span>Deadline: {format(new Date(a.due_date), "dd/MM/yy")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={a.status}
                      onValueChange={(v) =>
                        updateStatus.mutate({ id: a.id, status: v as ActionStatus })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not started">Non démarrée</SelectItem>
                        <SelectItem value="On going">En cours</SelectItem>
                        <SelectItem value="In delay">En retard</SelectItem>
                        <SelectItem value="Close">Fermée</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                      Détails
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Aucune action.
            </CardContent>
          </Card>
        )}
      </div>

      <EditDialog action={editing} onClose={() => setEditing(null)} />
    </div>
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
      {status}
    </span>
  );
}

function EditDialog({ action, onClose }: { action: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState(action?.action_plan ?? "");
  const [dueDate, setDueDate] = useState(action?.due_date ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!action) return null;

  async function save() {
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
          due_date: dueDate || null,
          evidence_correction_url,
        })
        .eq("id", action.id);
      if (error) throw error;
      toast.success("Mis à jour");
      qc.invalidateQueries({ queryKey: ["actions"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Détails de l'action</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-muted p-3 rounded">{action.issue_description}</div>
          <div>
            <Label>Plan d'action</Label>
            <Textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>Deadline</Label>
            <Input
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Preuve de correction</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
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