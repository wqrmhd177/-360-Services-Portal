import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";

export default function DashboardHomePage() {
  const session = getPortalSession();
  if (!session) {
    redirect("/");
  }

  const role = session.role;

  // Redirect to role-specific home page
  if (role === "growth") {
    redirect("/dashboard/growth");
  } else if (role === "approver") {
    redirect("/dashboard/approver");
  } else if (role === "procurement") {
    redirect("/dashboard/procurement");
  } else if (role === "finance") {
    redirect("/dashboard/finance");
  } else {
    // Default to growth if no role assigned
    redirect("/dashboard/growth");
  }
}

