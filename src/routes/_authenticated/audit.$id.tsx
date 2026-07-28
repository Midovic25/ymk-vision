import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera, Check, Lock, Minus, Save, X } from "lucide-react";

type Status = "OK" | "NG" | "NA";

interface GridItem {
  id: string;
  code: number;
  description: string | null;
  pillar: string;
}

export const Route = createFileRoute("/_authenticated/audit/$id")({
  head: () => ({
    meta: [
      { title: "Grille d'audit MOTO — Yazaki YMK" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <div className="p-8 text-center">
      <h2 className="text-lg font-bold">Audit indisponible</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Impossible de charger cet audit. Vérifiez votre connexion ou vos droits d'accès.
      </p>
    </div>
  ),
  component: AuditGrid,
});

function AuditGrid() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [ngDialog, setNgDialog] = useState<{
    entryIds: string[];
    item: GridItem;
    workstationLabel: string;
  } | null>(null);

  const { data: audit } = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id, audit_date, status, score, plant, line_id, area_id, lines(name), areas(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const lineId = audit?.line_id;
  const areaId = audit?.area_id ?? null;

  const { data: workstations } = useQuery({
    queryKey: ["grid-ws", lineId, areaId],
    enabled: !!lineId,
    queryFn: async () => {
      let q = supabase
        .from("workstations")
        .select("id, name, area_id, areas(name), pillars(name)")
        .eq("line_id", lineId!)
        .order("name");
      if (areaId) q = q.eq("area_id", areaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mapping } = useQuery({
    queryKey: ["grid-items", lineId, areaId, workstations?.length],
    enabled: !!workstations && workstations.length > 0,
    queryFn: async () => {
      const wsIds = workstations!.map((w) => w.id);
      const { data, error } = await supabase
        .from("workstation_items")
        .select("workstation_id, audit_items(id, code, description, pillars(name))")
        .in("workstation_id", wsIds);
      if (error) throw error;
      const items = new Map<string, GridItem>();
      const pairs = new Set<string>();
      for (const row of data ?? []) {
        const it = row.audit_items as unknown as {
          id: string;
          code: number;
          description: string | null;
          pillars: { name: string } | null;
        } | null;
        if (!it) continue;
        items.set(it.id, {
          id: it.id,
          code: it.code,
          description: it.description,
          pillar: it.pillars?.name ?? "Autres",
        });
        pairs.add(`${row.workstation_id}:${it.id}`);
      }
      return { items, pairs };
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["entries", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_entries")
        .select("id, workstation_id, item_id, status")
        .eq("audit_id", id);
      if (error) throw error;
      const m = new Map<string, { id: string; status: Status }>();
      for (const e of data ?? []) {
        m.set(`${e.workstation_id}:${e.item_id}`, { id: e.id, status: e.status as Status });
      }
      return m;
    },
  });

  const pillars = useMemo(() => {
    const s = new Set<string>();
    for (const it of mapping?.items.values() ?? []) s.add(it.pillar);
    return Array.from(s).sort();
  }, [mapping]);

  const rows = useMemo(() => {
    const all = Array.from(mapping?.items.values() ?? []).sort((a, b) => a.code - b.code);
    const scoped = pillarFilter === "all" ? all : all.filter((i) => i.pillar === pillarFilter);
    const grouped = new Map<string, GridItem[]>();
    for (const it of scoped) {
      const arr = grouped.get(it.pillar) ?? [];
      arr.push(it);
      grouped.set(it.pillar, arr);
    }
    return Array.from(grouped, ([pillar, items]) => ({ pillar, items }));
  }, [mapping, pillarFilter]);

  const closed = audit?.status === "closed";

  const setStatus = useMutation({
    mutationFn: async (p: { cells: Array<{ wsId: string; itemId: string }>; status: Status }) => {
      const created: string[] = [];
      for (const c of p.cells) {
        const existing = entries?.get(`${c.wsId}:${c.itemId}`);
        if (existing) {
          const { error } = await supabase
            .from("audit_entries")
            .update({ status: p.status })
            .eq("id", existing.id);
          if (error) throw error;
          created.push(existing.id);
        } else {
          const { data, error } = await supabase
            .from("audit_entries")
            .insert({
              audit_id: id,
              workstation_id: c.wsId,
              item_id: c.itemId,
              status: p.status,
            })
            .select("id")
            .single();
          if (error) throw error;
          created.push(data.id);
        }
      }
      return created;
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", id] }),
  });

  async function evaluate(
    cells: Array<{ wsId: string; itemId: string }>,
    status: Status,
    item: GridItem,
    workstationLabel: string,
  ) {
    if (closed || cells.length === 0) return;
    const entryIds = await setStatus.mutateAsync({ cells, status });
    if (status === "NG") setNgDialog({ entryIds, item, workstationLabel });
  }

  const stats = useMemo(() => {
    const s = { OK: 0, NG: 0, NA: 0, total: 0 };
    for (const e of entries?.values() ?? []) {
      s[e.status] += 1;
      s.total += 1;
    }
    return s;
  }, [entries]);
  const evaluated = stats.OK + stats.NG;
  const score = evaluated > 0 ? Math.round((stats.OK / evaluated) * 1000) / 10 : 0;

  const closeAudit = useMutation({
    mutationFn: async () => {
      // 1. Génération automatique du plan d'action pour chaque NG sans rapport
      const ngEntryIds = Array.from(entries?.entries() ?? [])
        .filter(([, v]) => v.status === "NG")
        .map(([, v]) => v.id);
      if (ngEntryIds.length) {
        const { data: existing } = await supabase
          .from("ng_actions")
          .select("entry_id")
          .in("entry_id", ngEntryIds);
        const done = new Set((existing ?? []).map((r) => r.entry_id));
        const missing = ngEntryIds.filter((e) => !done.has(e));
        if (missing.length) {
          const { error } = await supabase.from("ng_actions").insert(
            missing.map((entry_id) => ({
              entry_id,
              issue_description:
                "Non-conformité relevée lors de l'audit MOTO — rapport à compléter.",
              start_date: new Date().toISOString().slice(0, 10),
            })),
          );
          if (error) throw error;
        }
        // 2. Notification des responsables d'action assignés
        const { data: assigned } = await supabase
          .from("ng_actions")
          .select("id, assigned_to, issue_description, due_date")
          .in("entry_id", ngEntryIds)
          .not("assigned_to", "is", null);
        const notif = (assigned ?? [])
          .filter((a) => a.assigned_to)
          .map((a) => ({
            user_id: a.assigned_to as string,
            action_id: a.id,
            subject: "Nouvelle action corrective MOTO assignée",
            body: `Non-conformité : ${a.issue_description}\nÉchéance : ${
              a.due_date ?? "à définir"
            }`,
          }));
        if (notif.length) await supabase.from("notifications").insert(notif);
      }

      const { error } = await supabase
        .from("audits")
        .update({ status: "closed", closed_at: new Date().toISOString(), score })
        .eq("id", id);
      if (error) throw error;
      return { score, ng: ngEntryIds.length };
    },
    onSuccess: (r) => {
      toast.success(
        `Audit clôturé — Score ${r.score}% · ${r.ng} action(s) corrective(s) générée(s)`,
      );
      qc.invalidateQueries();
      navigate({ to: "/audit" });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Clôture impossible"),
  });

  const lineName = (audit?.lines as { name: string } | null)?.name ?? "…";
  const areaName = (audit?.areas as { name: string } | null)?.name;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/audit">
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux audits
        </Link>
      </Button>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl md:text-2xl font-bold">Grille d'audit — {lineName}</h1>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{audit?.plant ?? "YMK"}</Badge>
            {areaName && <Badge variant="outline">{areaName}</Badge>}
            <span>{audit?.audit_date}</span>
            <span>{closed ? "Clôturé" : "Brouillon en cours"}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <StatBadge label="OK" value={stats.OK} color="var(--status-ok)" />
          <StatBadge label="NG" value={stats.NG} color="var(--status-ng)" />
          <StatBadge label="NA" value={stats.NA} color="var(--status-na)" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Conformité
            </div>
            <div className="text-3xl font-bold text-primary">{score}%</div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56">
            <Label className="text-xs uppercase tracking-wider">Pilier</Label>
            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger>
                <SelectValue />
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
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => toast.success("Brouillon enregistré")}
              disabled={closed}
            >
              <Save className="h-4 w-4 mr-1" /> Enregistrer (brouillon)
            </Button>
            <Button onClick={() => closeAudit.mutate()} disabled={closed || closeAudit.isPending}>
              <Lock className="h-4 w-4 mr-1" /> Terminer et clôturer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Items de contrôle × Postes de travail ({workstations?.length ?? 0} postes)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-card border-b border-r px-3 py-2 text-left text-xs uppercase text-muted-foreground min-w-[280px]">
                    Item de contrôle
                  </th>
                  <th className="bg-card border-b border-r px-2 py-2 text-xs uppercase text-muted-foreground">
                    ALL
                  </th>
                  {workstations?.map((w) => (
                    <th
                      key={w.id}
                      className="bg-card border-b border-r px-2 py-2 text-[11px] font-semibold whitespace-nowrap"
                    >
                      {w.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((group) => (
                  <>
                    <tr key={group.pillar}>
                      <td
                        colSpan={(workstations?.length ?? 0) + 2}
                        className="bg-muted/60 border-b px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                      >
                        Pilier · {group.pillar}
                      </td>
                    </tr>
                    {group.items.map((it) => {
                      const applicable = (workstations ?? []).filter((w) =>
                        mapping?.pairs.has(`${w.id}:${it.id}`),
                      );
                      return (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="sticky left-0 z-10 bg-card border-b border-r px-3 py-1.5 align-top">
                            <div className="font-medium">#{it.code}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2 max-w-[260px]">
                              {it.description ?? "—"}
                            </div>
                          </td>
                          <td className="border-b border-r px-2 py-1.5">
                            <div className="flex gap-1">
                              {(["OK", "NG", "NA"] as Status[]).map((s) => (
                                <StatusButton
                                  key={s}
                                  status={s}
                                  active={false}
                                  compact
                                  disabled={closed || setStatus.isPending}
                                  onClick={() =>
                                    void evaluate(
                                      applicable.map((w) => ({ wsId: w.id, itemId: it.id })),
                                      s,
                                      it,
                                      "Tous les postes",
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </td>
                          {workstations?.map((w) => {
                            const ok = mapping?.pairs.has(`${w.id}:${it.id}`);
                            const current = entries?.get(`${w.id}:${it.id}`);
                            return (
                              <td key={w.id} className="border-b border-r px-2 py-1.5">
                                {ok ? (
                                  <div className="flex gap-1">
                                    {(["OK", "NG", "NA"] as Status[]).map((s) => (
                                      <StatusButton
                                        key={s}
                                        status={s}
                                        compact
                                        active={current?.status === s}
                                        disabled={closed || setStatus.isPending}
                                        onClick={() =>
                                          void evaluate(
                                            [{ wsId: w.id, itemId: it.id }],
                                            s,
                                            it,
                                            w.name,
                                          )
                                        }
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center text-muted-foreground">—</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Aucun item de contrôle pour ce périmètre.
            </div>
          )}
        </CardContent>
      </Card>

      <NgDialog
        dialog={ngDialog}
        auditAreaId={areaId}
        onClose={() => setNgDialog(null)}
      />
    </div>
  );
}

function StatusButton({
  status,
  active,
  onClick,
  disabled,
  compact,
}: {
  status: Status;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const Icon = status === "OK" ? Check : status === "NG" ? X : Minus;
  const bg =
    status === "OK"
      ? "bg-[var(--status-ok)]"
      : status === "NG"
        ? "bg-[var(--status-ng)]"
        : "bg-[var(--status-na)]";
  const size = compact ? "h-7 w-7" : "h-9 w-9";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={status}
      aria-label={status}
      className={`${size} rounded-md flex items-center justify-center border-2 transition-all ${
        active
          ? `${bg} text-white border-transparent shadow`
          : "bg-background border-border text-muted-foreground hover:border-primary/50"
      } disabled:opacity-50`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function NgDialog({
  dialog,
  auditAreaId,
  onClose,
}: {
  dialog: { entryIds: string[]; item: GridItem; workstationLabel: string } | null;
  auditAreaId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [desc, setDesc] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: responsibles } = useQuery({
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

  function reset() {
    setDesc("");
    setDepartment("");
    setDueDate("");
    setPriority("normal");
    setAssignedTo("");
    setFile(null);
  }

  async function save() {
    if (!dialog) return;
    if (!desc.trim()) return toast.error("Décrivez la non-conformité");
    if (!assignedTo) return toast.error("Assignez un Responsable Action");
    if (!dueDate) return toast.error("Date limite requise");
    setBusy(true);
    try {
      let evidence_url: string | null = null;
      if (file) {
        const path = `${dialog.entryIds[0]}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("audit-evidence")
          .upload(path, file);
        if (upErr) throw upErr;
        evidence_url = path;
      }
      const { error } = await supabase.from("ng_actions").upsert(
        dialog.entryIds.map((entry_id) => ({
          entry_id,
          issue_description: desc,
          department: department || null,
          area_id: auditAreaId,
          start_date: startDate || null,
          due_date: dueDate,
          priority,
          assigned_to: assignedTo,
          evidence_url,
        })),
        { onConflict: "entry_id" },
      );
      if (error) throw error;
      toast.success(
        `Rapport NG enregistré (${dialog.entryIds.length} poste${
          dialog.entryIds.length > 1 ? "s" : ""
        })`,
      );
      qc.invalidateQueries({ queryKey: ["actions"] });
      reset();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Rapport d'incident NG · Item #{dialog?.item.code}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-xs">
            <div>
              <span className="font-semibold">Pilier :</span> {dialog?.item.pillar}
            </div>
            <div>
              <span className="font-semibold">Poste concerné :</span> {dialog?.workstationLabel}
            </div>
            <div className="mt-1 text-muted-foreground">{dialog?.item.description ?? "—"}</div>
          </div>
          <div>
            <Label>Description de l'écart *</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Responsable Action *</Label>
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
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Département</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date de début</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Date limite *</Label>
              <Input
                type="date"
                value={dueDate}
                min={startDate}
                onChange={(e) => setDueDate(e.target.value)}
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