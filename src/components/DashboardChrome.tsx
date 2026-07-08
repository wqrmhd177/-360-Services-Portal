"use client";

import { Suspense, useState, type ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";

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

export default function DashboardChrome({ children }: DashboardChromeProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggle = () => setIsCollapsed((v) => !v);

  return (
    <div className="flex h-screen overflow-hidden bg-portal-50">
      <Suspense fallback={<SidebarFallback collapsed={isCollapsed} />}>
        <Sidebar collapsed={isCollapsed} onToggle={toggle} />
      </Suspense>
      <main className="flex-1 overflow-y-auto">
        <DashboardHeader collapsed={isCollapsed} onToggleSidebar={toggle} />
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

