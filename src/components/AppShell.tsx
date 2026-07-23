import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import logoAsset from "@/assets/yazaki_logo.png.asset.json";
import { useCurrentUser } from "@/hooks/use-current-user";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user, roles } = useCurrentUser();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-3 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-foreground" />
              <img src={logoAsset.url} alt="Yazaki" className="h-7 w-auto" />
              <div className="hidden md:block">
                <div className="text-sm font-semibold leading-tight">
                  {title ?? "MOTO Audit Platform"}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Yazaki Morocco · YMK Kenitra
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium">{user.email}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {roles.join(" · ") || "—"}
                  </div>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}