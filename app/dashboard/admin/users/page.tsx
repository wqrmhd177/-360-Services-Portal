import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import UserSettingsClient from "./UserSettingsClient";

export default function AdminUsersPage() {
  const session = getPortalSession();

  if (!session?.email) {
    redirect("/");
  }

  if (!session.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">User Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage roles, access, and permissions for portal users.
        </p>
      </div>
      <UserSettingsClient />
    </div>
  );
}
