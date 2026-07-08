"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NotificationCenter from "./NotificationCenter";

interface Session {
  email: string;
  fullName: string;
  role: string | null;
  isAdmin?: boolean;
}

export default function HeaderUserInfo() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">
        {session.fullName || "User"}
      </div>
      <div className="text-xs text-gray-500">
        {session.isAdmin ? (
          <span className="font-medium text-gray-700">Admin</span>
        ) : (
          <>
            Role:{" "}
            <span className="font-medium text-gray-700">
              {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unassigned"}
            </span>
          </>
        )}
      </div>
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
