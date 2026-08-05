import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";
import { RoleGate } from "@/hooks/use-role-guard";
import { normalizeCorporateEmail } from "@/lib/validation";
import { ROLE_LABEL_FR } from "@/types/domain";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Propriétés des comptes — Yazaki MOTO" },
      {
        name: "description",
        content:
          "Registre administrateur des comptes de la plateforme MOTO : habilitations, paramètres et identifiants de recette.",
      },
      { property: "og:title", content: "Propriétés des comptes — Yazaki MOTO" },
      {
        property: "og:description",
        content: "Registre administrateur des comptes et habilitations MOTO.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: routeErrorComponent("Propriétés des comptes indisponibles"),
  component: () => (
    <RoleGate allowed={["admin"]}>
      <AccountsPage />
    </RoleGate>
  ),
});

function AccountsPage() {
  const [reveal, setReveal] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["account-properties"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, department, approved, approved_at, created_at, line_id");
      if (error) throw error;
      const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
      const byUser = new Map<string, string[]>();
      for (const r of roleRows ?? []) {
        const a = byUser.get(r.user_id) ?? [];
        a.push(r.role);
        byUser.set(r.user_id, a);
      }
      return (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
    },
  });

  const secretOf = (email: string | null) =>
    DEMO_ACCOUNTS.find((d) => d.email === (email ?? "").toLowerCase())?.password ?? null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <KeyRound className="text-primary" /> Propriétés des comptes
        </h1>
        <p className="text-sm text-muted-foreground">
          Registre complet des identités de la plateforme : habilitations, paramètres de
          profil et identifiants des comptes de recette.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-3xl text-xs text-muted-foreground">
            Les mots de passe des comptes nominatifs sont stockés sous forme de condensats
            irréversibles par le service d'authentification : ils ne sont consultables par
            aucun administrateur. Seuls les comptes de recette ci-dessous disposent d'un
            secret documenté ; utilisez la réinitialisation de mot de passe pour les autres.
          </p>
          <Button variant="outline" size="sm" onClick={() => setReveal((v) => !v)}>
            {reveal ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
            {reveal ? "Masquer les secrets" : "Afficher les secrets de recette"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptes et paramètres</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Département</th>
                  <th className="px-3 py-2">Habilitations</th>
                  <th className="px-3 py-2">État</th>
                  <th className="px-3 py-2">Créé le</th>
                  <th className="px-3 py-2">Mot de passe</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => {
                  const secret = secretOf(u.email);
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{u.full_name ?? "—"}</td>
                      <td className="px-3 py-2">{normalizeCorporateEmail(u.email)}</td>
                      <td className="px-3 py-2">{u.department ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">Aucune</span>
                          )}
                          {u.roles.map((r) => (
                            <Badge key={r} variant="secondary">
                              {ROLE_LABEL_FR[r as keyof typeof ROLE_LABEL_FR] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            u.approved
                              ? "text-[11px] font-semibold uppercase text-[var(--status-ok)]"
                              : "text-[11px] font-semibold uppercase text-[var(--status-ng)]"
                          }
                        >
                          {u.approved ? "Actif" : "Suspendu"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {u.created_at.slice(0, 10)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {secret ? (
                          reveal ? (
                            secret
                          ) : (
                            "••••••••••••"
                          )
                        ) : (
                          <span className="text-muted-foreground">Chiffré (non lisible)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}