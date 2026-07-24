import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, X, Minus, Lock, Save } from "lucide-react";

type Mode = "ALL" | "ONE" | "ONE_PLUS";
type Status = "OK" | "NG" | "NA";

export const Route = createFileRoute("/_authenticated/audit/$id")({
  head: () => ({
    meta: [
      { title: "Saisie audit — Yazaki MOTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditDetail,
});

function AuditDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("ALL");
  const [selectedWs, setSelectedWs] = useState<string>("");
  const [ngDialog, setNgDialog] = useState<{
    entryId: string;
    itemCode: number;
  } | null>(null);

  const { data: audit } = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("*, lines(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const lineId = (audit as any)?.lines?.id;

  const { data: workstations } = useQuery({
    queryKey: ["ws", lineId],
    enabled: !!lineId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workstations")
        .select("id, name, areas(name), pillars(name)")
        .eq("line_id", lineId)
        .order("name");
      return data ?? [];
    },
  });

  const { data: itemsMap } = useQuery({
    queryKey: ["ws-items", lineId],
    enabled: !!workstations && workstations.length > 0,
    queryFn: async () => {
      const wsIds = workstations!.map((w) => w.id);
      const { data } = await supabase
        .from("workstation_items")
        .select("workstation_id, audit_items(id, code, description)")
        .in("workstation_id", wsIds);
      const m = new Map<string, Array<{ id: string; code: number; description: string | null }>>();
      for (const r of data ?? []) {
        const arr = m.get(r.workstation_id) ?? [];
        arr.push((r as any).audit_items);
        m.set(r.workstation_id, arr);
      }
      for (const [k, v] of m) m.set(k, v.sort((a, b) => a.code - b.code));
      return m;
    },
  });

  const { data: entries, refetch: refetchEntries } = useQuery({
    queryKey: ["entries", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_entries")
        .select("id, workstation_id, item_id, status")
        .eq("audit_id", id);
      const m = new Map<string, { id: string; status: Status }>();
      for (const e of data ?? []) {
        m.set(`${e.workstation_id}:${e.item_id}`, {
          id: e.id,
          status: e.status as Status,
        });
      }
      return m;
    },
  });

  const saveEntry = useMutation({
    mutationFn: async (p: { wsId: string; itemId: string; itemCode: number; status: Status }) => {
      const key = `${p.wsId}:${p.itemId}`;
      const existing = entries?.get(key);
      let entryId = existing?.id;
      if (existing) {
        const { error } = await supabase
          .from("audit_entries")
          .update({ status: p.status })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("audit_entries")
          .insert({
            audit_id: id,
            workstation_id: p.wsId,
            item_id: p.itemId,
            status: p.status,
          })
          .select("id")
          .single();
        if (error) throw error;
        entryId = data.id;
      }
      return { entryId: entryId!, itemCode: p.itemCode, status: p.status };
    },
    onSuccess: (r) => {
      refetchEntries();
      if (r.status === "NG") setNgDialog({ entryId: r.entryId, itemCode: r.itemCode });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeAudit = useMutation({
    mutationFn: async () => {
      const total = entries?.size ?? 0;
      const ok = Array.from(entries?.values() ?? []).filter((e) => e.status === "OK").length;
      const score = total > 0 ? Math.round((ok / total) * 1000) / 10 : 0;
      const { error } = await supabase
        .from("audits")
        .update({ status: "closed", closed_at: new Date().toISOString(), score })
        .eq("id", id);
      if (error) throw error;
      return score;
    },
    onSuccess: (score) => {
      toast.success(`Audit clôturé — Score: ${score}%`);
      qc.invalidateQueries();
      navigate({ to: "/audit" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter workstations displayed based on mode
  const displayedWs = useMemo(() => {
    if (!workstations) return [];
    if (mode === "ALL") return workstations;
    if (mode === "ONE") return selectedWs ? workstations.filter((w) => w.id === selectedWs) : [];
    // ONE_PLUS: selected + all similar (same area/pillar)
    if (mode === "ONE_PLUS" && selectedWs) {
      const ref = workstations.find((w) => w.id === selectedWs);
      if (!ref) return [];
      return workstations.filter(
        (w) =>
          (w as any).areas?.name === (ref as any).areas?.name &&
          (w as any).pillars?.name === (ref as any).pillars?.name,
      );
    }
    return [];
  }, [workstations, mode, selectedWs]);

  const stats = useMemo(() => {
    const s = { OK: 0, NG: 0, NA: 0, total: 0 };
    for (const e of entries?.values() ?? []) {
      s[e.status]++;
      s.total++;
    }
    return s;
  }, [entries]);
  const score = stats.total > 0 ? Math.round((stats.OK / stats.total) * 1000) / 10 : 0;
  const closed = audit?.status === "closed";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            Audit — {(audit as any)?.lines?.name ?? "…"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {audit?.audit_date} · {closed ? "Clôturé" : "En cours"}
          </p>
        </div>
        <div className="flex gap-6 items-center">
          <StatBadge label="OK" value={stats.OK} color="var(--status-ok)" />
          <StatBadge label="NG" value={stats.NG} color="var(--status-ng)" />
          <StatBadge label="NA" value={stats.NA} color="var(--status-na)" />
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Score</div>
            <div className="text-3xl font-bold text-primary">{score}%</div>
          </div>
          {!closed && (
            <Button variant="default" onClick={() => closeAudit.mutate()}>
              <Lock className="h-4 w-4 mr-1" /> Clôturer
            </Button>
          )}
        </div>
      </div>

      {!closed && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs uppercase tracking-wider">Mode de saisie</Label>
              <div className="flex gap-1 mt-1">
                {(["ALL", "ONE", "ONE_PLUS"] as Mode[]).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={mode === m ? "default" : "outline"}
                    onClick={() => setMode(m)}
                  >
                    {m === "ALL" ? "Tous postes" : m === "ONE" ? "1 poste" : "1 + similaires"}
                  </Button>
                ))}
              </div>
            </div>
            {(mode === "ONE" || mode === "ONE_PLUS") && (
              <div className="flex-1 min-w-64">
                <Label className="text-xs uppercase tracking-wider">Poste</Label>
                <Select value={selectedWs} onValueChange={setSelectedWs}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un poste..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workstations?.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} — {(w as any).areas?.name} / {(w as any).pillars?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {displayedWs.map((ws) => {
          const items = itemsMap?.get(ws.id) ?? [];
          return (
            <Card key={ws.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="font-bold">{ws.name}</span>
                  <Badge variant="outline">{(ws as any).areas?.name}</Badge>
                  <Badge variant="outline">{(ws as any).pillars?.name}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {items.length} items
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1">
                  {items.map((it) => {
                    const current = entries?.get(`${ws.id}:${it.id}`);
                    return (
                      <div
                        key={it.id}
                        className="flex items-center gap-2 py-1.5 border-b last:border-b-0 hover:bg-muted/40 px-2 rounded"
                      >
                        <div className="w-14 text-xs font-mono text-muted-foreground">
                          #{it.code}
                        </div>
                        <div className="flex-1 text-sm">
                          {it.description || `Item ${it.code}`}
                        </div>
                        <div className="flex gap-1">
                          {(["OK", "NG", "NA"] as Status[]).map((s) => (
                            <StatusButton
                              key={s}
                              status={s}
                              active={current?.status === s}
                              disabled={closed || saveEntry.isPending}
                              onClick={() =>
                                saveEntry.mutate({
                                  wsId: ws.id,
                                  itemId: it.id,
                                  itemCode: it.code,
                                  status: s,
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Aucun item pour ce poste.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {displayedWs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Sélectionnez un poste pour commencer la saisie.
            </CardContent>
          </Card>
        )}
      </div>

      <NgDialog dialog={ngDialog} onClose={() => setNgDialog(null)} />
    </div>
  );
}

function StatusButton({
  status,
  active,
  onClick,
  disabled,
}: {
  status: Status;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = status === "OK" ? Check : status === "NG" ? X : Minus;
  const bg =
    status === "OK"
      ? "bg-[var(--status-ok)]"
      : status === "NG"
      ? "bg-[var(--status-ng)]"
      : "bg-[var(--status-na)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 w-9 rounded-md flex items-center justify-center font-bold text-xs border-2 transition-all ${
        active
          ? `${bg} text-white border-transparent shadow`
          : "bg-background border-border text-muted-foreground hover:border-primary/50"
      } disabled:opacity-50`}
      aria-label={status}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function NgDialog({
  dialog,
  onClose,
}: {
  dialog: { entryId: string; itemCode: number } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [desc, setDesc] = useState("");
  const [department, setDepartment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: responsibles } = useQuery2({
    queryKey: ["action-responsibles"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "action_responsible");
      const ids = (rows ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .in("id", ids);
      return profs ?? [];
    },
  });

  async function save() {
    if (!dialog) return;
    if (!desc.trim()) return toast.error("Décrivez la non-conformité");
    if (!assignedTo) return toast.error("Assignez un Responsable Action");
    if (!dueDate) return toast.error("Date limite requise");
    setBusy(true);
    try {
      let evidence_url: string | null = null;
      if (file) {
        const path = `${dialog.entryId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("audit-evidence")
          .upload(path, file);
        if (upErr) throw upErr;
        evidence_url = path;
      }
      const { error } = await supabase.from("ng_actions").insert({
        entry_id: dialog.entryId,
        issue_description: desc,
        department: department || null,
        due_date: dueDate || null,
        assigned_to: assignedTo || null,
        evidence_url,
      });
      if (error) throw error;
      toast.success("Non-conformité enregistrée");
      qc.invalidateQueries({ queryKey: ["actions"] });
      setDesc("");
      setDepartment("");
      setDueDate("");
      setAssignedTo("");
      setFile(null);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Rapport d'incident NG · Item #{dialog?.itemCode}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Description de la non-conformité *</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Ex : absence de marquage sur le poste, câblage hors gabarit…"
            />
          </div>
          <div>
            <Label>Responsable de l'action *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Attribuer à un Responsable Action…" />
              </SelectTrigger>
              <SelectContent>
                {(responsibles ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                    {p.department ? ` — ${p.department}` : ""}
                  </SelectItem>
                ))}
                {responsibles && responsibles.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Aucun Responsable Action déclaré — contactez l'administrateur.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Département</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex : Production"
              />
            </div>
            <div>
              <Label>Date limite *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <div>
            <Label>Preuve visuelle (photo terrain)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Camera className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={busy}>
            <Save className="h-4 w-4 mr-1" /> Créer le rapport NG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}