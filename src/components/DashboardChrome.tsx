"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { DashboardNavProvider } from "@/components/DashboardNavContext";
import { useIsLgUp } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface DashboardChromeProps {
  children: ReactNode;
}

function SidebarFallback({ collapsed, className }: { collapsed: boolean; className?: string }) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-portal-700 bg-portal-900 transition-all duration-200",
        collapsed ? "w-20" : "w-64",
        className,
      )}
    >
      <div className="flex h-20 items-center justify-center border-b border-portal-700">
        <div className="h-6 w-6 animate-pulse rounded bg-portal-700" />
      </div>
    </aside>
  );
}

function DashboardMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOperations = pathname?.startsWith("/dashboard/operations") ?? false;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
      {!isOperations ? <DashboardHeader /> : null}
      <div
        className={cn(
          "min-w-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5",
          isOperations && "px-4 py-3",
        )}
      >
        {children}
      </div>
    </main>
  );
}

export default function DashboardChrome({ children }: DashboardChromeProps) {
  const pathname = usePathname();
  const isLgUp = useIsLgUp();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleCollapsed = () => setIsCollapsed((v) => !v);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLgUp) setMobileNavOpen(false);
  }, [isLgUp]);

  useEffect(() => {
    if (!mobileNavOpen || isLgUp) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen, isLgUp]);

  const sidebarCollapsed = isLgUp ? isCollapsed : false;
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <DashboardNavProvider mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen}>
      <div className="flex h-[100dvh] overflow-hidden bg-portal-50">
        {mobileNavOpen && !isLgUp ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Close navigation menu"
            onClick={closeMobileNav}
          />
        ) : null}

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full shrink-0 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0",
            mobileNavOpen || isLgUp ? "translate-x-0" : "-translate-x-full",
          )}
          aria-hidden={!isLgUp && !mobileNavOpen}
        >
          <Suspense
            fallback={
              <SidebarFallback collapsed={sidebarCollapsed} className="h-[100dvh] lg:h-screen" />
            }
          >
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={isLgUp ? toggleCollapsed : undefined}
              onNavigate={closeMobileNav}
              showMobileClose={!isLgUp}
              onMobileClose={closeMobileNav}
            />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
          }
        >
          <DashboardMain>{children}</DashboardMain>
        </Suspense>
      </div>
    </DashboardNavProvider>
  );
}
