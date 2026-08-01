import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoAsset from "@/assets/yazaki_logo.png.asset.json";
import { useCurrentUser, roleLabel, initialsOf } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, ChevronDown, ShieldAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, roles, profile, avatarSrc, loading } = useCurrentUser();
  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Utilisateur";
  const pending = !loading && !!user && profile !== null && profile.approved === false;
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b bg-card px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-foreground" />
              <div className="hidden md:block border-l pl-3">
                <div className="text-sm font-semibold leading-tight">
                  {title ?? "Plateforme Numérique MOTO"}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Yazaki Morocco · YMK Kenitra
                </div>
              </div>
            </div>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 rounded-full pl-2 pr-3 py-1.5 hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold leading-tight">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {roleLabel(roles)}
                    </div>
                  </div>
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center font-bold text-sm shadow ring-2 ring-primary/10">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initialsOf(profile?.full_name, user.email)
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="font-semibold">{displayName}</div>
                    <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                    <div className="text-[10px] font-normal uppercase tracking-wider text-primary mt-1">
                      {roleLabel(roles)}
                    </div>
                    {profile?.department && (
                      <div className="text-xs font-normal text-muted-foreground mt-0.5">
                        Département : {profile.department}
                      </div>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Mon profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = "/auth";
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>
          <main className="flex-1">
            {pending ? (
              <div className="p-10 flex justify-center">
                <div className="max-w-md text-center border rounded-xl p-8 bg-card">
                  <ShieldAlert className="h-10 w-10 mx-auto text-primary mb-3" />
                  <h2 className="text-lg font-bold">Compte en attente de validation</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Votre inscription a bien été enregistrée. Un administrateur doit valider votre
                    compte et vous attribuer un rôle avant l'accès à la plateforme.
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
