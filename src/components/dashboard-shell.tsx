'use client'

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ title, subtitle, actions, children }: Props) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
              <SidebarTrigger className="press shrink-0 rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
                {subtitle && (
                  <p className="hidden truncate text-xs text-sidebar-foreground/60 sm:block">
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {actions}
                <CurrencySwitcher />
                <ThemeToggle className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  className="press rounded-none text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={async () => {
                    await signOut();
                    router.push("/auth");
                  }}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>

            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
