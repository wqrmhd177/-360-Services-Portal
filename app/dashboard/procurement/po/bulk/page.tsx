import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import BulkPoUploadClient from "./BulkPoUploadClient";

export default function BulkPoPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const canCreate = session.role === "procurement" || session.isAdmin;
  if (!canCreate) {
    redirect("/dashboard/procurement/po");
  }

  return <BulkPoUploadClient />;
}
