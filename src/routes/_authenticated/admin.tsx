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
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";

type Role = "admin" | "moto_responsible" | "action_responsible" | "department_manager";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Administration — Yazaki MOTO" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { roles, loading } = useCurrentUser();
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: roles.includes("admin"),
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, department");
      const { data: rolesRows } = await supabase.from("user_roles").select("user_id, role");
      const rolesByUser = new Map<string, string[]>();
      for (const r of rolesRows ?? []) {
        const a = rolesByUser.get(r.user_id) ?? [];
        a.push(r.role);
        rolesByUser.set(r.user_id, a);
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
  });

  const assign = useMutation({
    mutationFn: async (p: { userId: string; role: Role }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: p.userId, role: p.role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Rôle attribué");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (p: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", p.userId)
        .eq("role", p.role);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (loading) return <div className="p-8">Chargement…</div>;
  if (!roles.includes("admin"))
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted-foreground">Gestion des utilisateurs et rôles.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 px-3">Nom</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Département</th>
                <th className="py-2 px-3">Rôles</th>
                <th className="py-2 px-3">Attribuer</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="py-2 px-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="py-2 px-3">{u.email}</td>
                  <td className="py-2 px-3">{u.department ?? "—"}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <Badge
                          key={r}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => revoke.mutate({ userId: u.id, role: r })}
                          title="Cliquer pour révoquer"
                        >
                          {r} ×
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <Select
                      onValueChange={(v) =>
                        assign.mutate({ userId: u.id, role: v as Role })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="+ Rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="moto_responsible">Moto Responsible</SelectItem>
                        <SelectItem value="action_responsible">Action Responsible</SelectItem>
                        <SelectItem value="department_manager">Department Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}