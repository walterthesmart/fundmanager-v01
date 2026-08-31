'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  ScrollText,
  Banknote,
  Package,
  Users,
} from "lucide-react";

import logoAsset from "@/assets/sankore-logo.png.asset.json";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const coreItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientele", url: "/clients", icon: Users },
  { title: "Products", url: "/products", icon: Package },
  { title: "Cash Operations", url: "/cash", icon: Banknote },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Audit Log", url: "/audit-log", icon: ScrollText },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center bg-sidebar-accent/60 p-1 transition-transform duration-300 hover:scale-105">
            <img src={logoAsset.url} alt="Sankore Fund Manager logo" className="size-full object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">Sankore</p>
              <p className="truncate text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/55">
                Fund Manager
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            Modules
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => {
                const active = pathname === item.url || (pathname?.startsWith(item.url) && item.url !== '/');
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="accent-rail press rounded-none transition-colors duration-200"
                      data-active={active}
                    >
                      <Link href={item.url} className="group flex items-center gap-2.5">
                        <item.icon className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <p className="px-2 py-1 text-[11px] leading-relaxed text-sidebar-foreground/45">
            Sankore Fund Manager
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
