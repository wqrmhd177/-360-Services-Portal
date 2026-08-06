"use client";

import { Suspense, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { cn } from "@/lib/utils";

interface DashboardChromeProps {
  children: ReactNode;
}

function SidebarFallback({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={`flex flex-col border-r border-portal-700 bg-portal-900 transition-all duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex h-20 items-center justify-center border-b border-portal-700">
        <div className="h-6 w-6 animate-pulse rounded bg-portal-700" />
      </div>
    </aside>
  );
}

function DashboardMain({
  children,
  collapsed,
  onToggleSidebar,
}: {
  children: ReactNode;
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const hideTopBar = pathname?.includes("/operations/nd-report") ?? false;

  return (
    <main className="flex-1 overflow-y-auto">
      {!hideTopBar ? (
        <DashboardHeader collapsed={collapsed} onToggleSidebar={onToggleSidebar} />
      ) : null}
      <div className={cn("p-8", hideTopBar && "pt-4")}>{children}</div>
    </main>
  );
}

export default function DashboardChrome({ children }: DashboardChromeProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const toggle = () => setIsCollapsed((v) => !v);

  return (
    <div className="flex h-screen overflow-hidden bg-portal-50">
      <Suspense fallback={<SidebarFallback collapsed={isCollapsed} />}>
        <Sidebar collapsed={isCollapsed} onToggle={toggle} />
      </Suspense>
      <Suspense fallback={<div className="flex-1 overflow-y-auto p-8">{children}</div>}>
        <DashboardMain collapsed={isCollapsed} onToggleSidebar={toggle}>
          {children}
        </DashboardMain>
      </Suspense>
    </div>
  );
}
