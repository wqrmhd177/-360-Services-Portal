"use client";

import { usePathname } from "next/navigation";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isAuthPage = pathname?.startsWith("/auth");
  const isDashboard = pathname?.startsWith("/dashboard");

  // For home page and auth pages, render without sidebar; use full height so login/signup center correctly
  if (isHomePage || isAuthPage) {
    return <main className="flex-1 flex flex-col min-h-screen">{children}</main>;
  }

  // For dashboard pages, the sidebar layout is handled by dashboard/layout.tsx
  // Just render children directly without any additional wrapper
  if (isDashboard) {
    return <>{children}</>;
  }

  // Fallback for any other pages
  return <main className="flex-1">{children}</main>;
}
