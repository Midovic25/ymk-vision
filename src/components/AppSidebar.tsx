import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Users,
  User,
  LogOut,
  BarChart3,
  Inbox,
  KeyRound,
  Activity,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoAsset from "@/assets/yazaki_logo.png.asset.json";
import markAsset from "@/assets/yazaki_mark.webp.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type Item = {
  title: string;
  url: string;
  icon: typeof Home;
  exact?: boolean;
  roles?: string[];
};

const items: Item[] = [
  { title: "Accueil", url: "/home", icon: Home, exact: true },
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard, roles: ["department_manager", "moto_responsible"] },
  { title: "Pilotage département", url: "/department", icon: BarChart3, roles: ["department_manager"] },
  { title: "Saisie d'audit", url: "/audit", icon: ClipboardList, roles: ["moto_responsible"] },
  { title: "Mes actions", url: "/my-actions", icon: Inbox, roles: ["action_responsible"] },
  { title: "Plans d'action", url: "/actions", icon: AlertTriangle, roles: ["action_responsible", "department_manager", "moto_responsible"] },
  { title: "Administration", url: "/admin", icon: Users, roles: ["admin"] },
  { title: "Propriétés comptes", url: "/accounts", icon: KeyRound, roles: ["admin"] },
  { title: "Activité utilisateurs", url: "/activity", icon: Activity, roles: ["admin"] },
  { title: "Mon profil", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles } = useCurrentUser();
  const homeUrl = "/";

  const isActive = (url: string, exact?: boolean) =>
    exact
      ? pathname === (url === "/home" ? homeUrl : url)
      : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div
          className={
            collapsed
              ? "flex items-center justify-center px-1 py-3"
              : "flex items-center gap-2 px-2 py-3"
          }
        >
          {collapsed ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
              <img src={markAsset.url} alt="Yazaki" className="h-4 w-auto object-contain" />
            </div>
          ) : (
            <div className="shrink-0 rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-black/5">
              <img src={logoAsset.url} alt="Yazaki" className="h-9 w-auto object-contain" />
            </div>
          )}
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold text-sidebar-foreground tracking-wide">YAZAKI</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
                MOTO · YMK Kenitra
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                // Navigation strictement métier : l'administrateur pilote les comptes,
                // il n'exécute ni audit ni plan d'action.
                .filter((it) => !it.roles || it.roles.some((r) => roles.includes(r)))
                .map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url, item.exact)}
                      tooltip={item.title}
                    >
                      <Link
                        to={item.url === "/home" ? homeUrl : item.url}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-5 w-5" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Déconnexion"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                >
                  <LogOut className="h-5 w-5" />
                  {!collapsed && <span>Déconnexion</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}