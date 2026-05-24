import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import DashboardChrome from "@/components/DashboardChrome";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const session = getPortalSession();
  if (!session) {
    redirect("/");
  }

  return (
    <DashboardChrome>{children}</DashboardChrome>
  );
}

