import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import { getAnnouncements } from "@/lib/announcements";
import ProcurementAnnouncementManager from "@/components/ProcurementAnnouncementManager";

export default async function ProcurementAnnouncementPage() {
  const session = getPortalSession();

  if (!session?.email) {
    redirect("/auth/login");
  }

  const isProcurement = session.role === "procurement";
  const isAdmin = !!session.isAdmin;

  if (!isProcurement && !isAdmin) {
    redirect("/dashboard");
  }

  const announcements = await getAnnouncements({ limit: 20 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Procurement Announcements
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Share your physical availability and other important messages with all portal users.
        </p>
      </div>
      <div className="card">
        <ProcurementAnnouncementManager initialAnnouncements={announcements} />
      </div>
    </div>
  );
}

