import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import { deriveEffectivePermissions } from "@/lib/permissions";

export default function DashboardHomePage() {
  const session = getPortalSession();
  if (!session) {
    redirect("/");
  }

  if (session.isAdmin) {
    redirect("/dashboard/growth");
  }

  const { zambeelPerms, paRole, productListing, operations } = deriveEffectivePermissions({
    role: session.role,
    isAdmin: session.isAdmin,
    permissions: session.permissions,
  });

  if (zambeelPerms.includes("growth")) redirect("/dashboard/growth");
  if (zambeelPerms.includes("approver")) redirect("/dashboard/approver");
  if (zambeelPerms.includes("procurement")) redirect("/dashboard/procurement");
  if (zambeelPerms.includes("finance")) redirect("/dashboard/finance");
  if (paRole) redirect("/dashboard/product-availability");
  if (productListing) redirect("/dashboard/product-listing/suppliers");
  if (operations) redirect("/dashboard/operations");

  const role = session.role;
  if (role === "growth") redirect("/dashboard/growth");
  if (role === "approver") redirect("/dashboard/approver");
  if (role === "procurement") redirect("/dashboard/procurement");
  if (role === "finance") redirect("/dashboard/finance");
  if (role === "agent" || role === "purchaser" || role === "manager") {
    redirect("/dashboard/product-availability");
  }

  redirect("/dashboard/growth");
}

