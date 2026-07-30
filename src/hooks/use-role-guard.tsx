import type { ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { AppRole } from "@/types/domain";

export type AccessState = "loading" | "granted" | "pending_approval" | "denied";

/**
 * Client-side RBAC gate. This is a UX affordance only — the authoritative
 * enforcement lives in the database RLS policies. Never rely on it alone.
 */
export function useRoleGuard(allowed: readonly AppRole[]): {
  state: AccessState;
  roles: string[];
} {
  const { roles, profile, loading } = useCurrentUser();

  if (loading) return { state: "loading", roles };
  if (profile && profile.approved === false) return { state: "pending_approval", roles };
  if (allowed.length === 0) return { state: "granted", roles };
  if (roles.includes("admin")) return { state: "granted", roles };
  const granted = allowed.some((r) => roles.includes(r));
  return { state: granted ? "granted" : "denied", roles };
}

export function RoleGate({
  allowed,
  children,
}: {
  allowed: readonly AppRole[];
  children: ReactNode;
}) {
  const { state } = useRoleGuard(allowed);

  if (state === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Vérification des habilitations…
      </div>
    );
  }

  if (state === "pending_approval") {
    return (
      <Notice
        title="Compte en attente de validation"
        message="Un administrateur doit valider votre compte et vous attribuer un rôle avant l'accès à cette section."
      />
    );
  }

  if (state === "denied") {
    return (
      <Notice
        title="Accès non autorisé"
        message="Votre rôle ne vous permet pas de consulter cette section. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur."
      />
    );
  }

  return <>{children}</>;
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}