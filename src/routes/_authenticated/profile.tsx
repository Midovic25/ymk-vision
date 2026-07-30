import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser, roleLabel, initialsOf } from "@/hooks/use-current-user";
import { Camera } from "lucide-react";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Mon profil — Yazaki MOTO" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: routeErrorComponent("Profil indisponible"),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles, avatarSrc } = useCurrentUser();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setDepartment(profile.department ?? "");
    }
  }, [profile]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 3600);
      setLocalAvatar(signed?.signedUrl ?? null);
      qc.invalidateQueries();
      toast.success("Photo de profil mise à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          department,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enregistré");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Mon profil</h1>
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 pb-2">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xl font-bold ring-2 ring-primary/10">
              {localAvatar || avatarSrc ? (
                <img
                  src={localAvatar ?? avatarSrc ?? ""}
                  alt="Photo de profil"
                  className="h-full w-full object-cover"
                />
              ) : (
                initialsOf(fullName, user?.email)
              )}
            </div>
            <div className="min-w-0">
              <Label className="flex items-center gap-2">
                <Camera className="h-4 w-4" /> Photo de profil
              </Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="mt-1"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {roleLabel(roles)}
              </p>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div>
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Département</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div>
            <Label>Rôles</Label>
            <div className="flex gap-1 mt-1">
              {roles.length > 0 ? (
                roles.map((r) => <Badge key={r}>{r}</Badge>)
              ) : (
                <span className="text-sm text-muted-foreground">
                  Aucun rôle — contactez un administrateur.
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}