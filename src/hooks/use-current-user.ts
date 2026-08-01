import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "moto_responsible" | "action_responsible" | "department_manager";

export interface ProfileLite {
  full_name: string | null;
  department: string | null;
  avatar_url: string | null;
  approved: boolean;
}

export interface CurrentUser {
  user: User | null;
  roles: string[];
  profile: ProfileLite | null;
  avatarSrc: string | null;
  loading: boolean;
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrateur",
  moto_responsible: "Responsable MOTO",
  action_responsible: "Responsable Action",
  department_manager: "Chef de Département",
};

export function roleLabel(roles: string[]): string {
  if (!roles.length) return "En attente de validation";
  return roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ");
}

export function initialsOf(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || (email ?? "");
  return (
    src
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load(u: User | null) {
      if (!u) {
        if (!mounted) return;
        setRoles([]);
        setProfile(null);
        setAvatarSrc(null);
        return;
      }
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.id),
        supabase
          .from("profiles")
          .select("full_name, department, avatar_url, approved")
          .eq("id", u.id)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      setRoles((r ?? []).map((x) => x.role));
      setProfile((p as ProfileLite | null) ?? null);
      if (p?.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(p.avatar_url, 3600);
        if (mounted) setAvatarSrc(signed?.signedUrl ?? null);
      } else if (mounted) {
        setAvatarSrc(null);
      }
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      await load(data.user ?? null);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRoles([]);
        setProfile(null);
        setAvatarSrc(null);
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/auth") &&
          window.location.pathname !== "/"
        ) {
          window.location.href = "/auth";
        }
        return;
      }
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      void load(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, roles, profile, avatarSrc, loading };
}

/** Route d'accueil applicative selon le rôle (utilisateur connecté). */
export function primaryRoute(roles: string[]): string {
  if (roles.includes("admin")) return "/dashboard";
  if (roles.includes("department_manager")) return "/dashboard";
  if (roles.includes("action_responsible")) return "/actions";
  if (roles.includes("moto_responsible")) return "/dashboard";
  return "/profile";
}
