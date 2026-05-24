"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import NotificationCenter from "./NotificationCenter";
import type { UserRole } from "@/lib/simpleAuth";

interface Session {
  email: string;
  fullName: string;
  role: string | null;
  isAdmin?: boolean;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "growth", label: "Growth" },
  { value: "approver", label: "Approver" },
  { value: "procurement", label: "Procurement" },
  { value: "finance", label: "Finance" },
];

export default function HeaderUserInfo() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/dashboard")) {
      fetch("/api/auth/session")
        .then((res) => res.json())
        .then((data) => {
          if (data.session) {
            setSession(data.session);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [pathname]);

  if (!pathname?.startsWith("/dashboard") || !session || loading) {
    return null;
  }

  const role = session.role ?? null;
  const isAdmin = !!session.isAdmin;

  const handleRoleChange = async (newRole: UserRole) => {
    if (!isAdmin || newRole === role) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/admin/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        router.push("/dashboard");
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">
        {session.fullName || "User"}
      </div>
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">View as:</span>
          <select
            value={role ?? "growth"}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            disabled={switching}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-xs text-gray-500">
          Department: <span className="font-medium text-gray-700">{role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unassigned"}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <NotificationCenter userEmail={session.email} />
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
