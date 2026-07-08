import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import ZyncWelcome from "@/components/ZyncWelcome";

export default function DashboardHomePage() {
  const session = getPortalSession();
  if (!session) {
    redirect("/");
  }

  return <ZyncWelcome userName={session.fullName} />;
}
