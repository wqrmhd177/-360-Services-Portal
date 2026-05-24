"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationCenter from "./NotificationCenter";

interface ActiveAnnouncement {
  body: string;
  title: string | null;
}

interface Session {
  email: string;
}

interface DashboardHeaderProps {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function DashboardHeader({ collapsed, onToggleSidebar }: DashboardHeaderProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState<ActiveAnnouncement | null>(null);
  const [announcementLoaded, setAnnouncementLoaded] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 400);
  };

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.session) {
          setSession(data.session);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load announcements and pick the latest active one
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const active = data.find((a: any) => a.is_active && a.body);
          if (active) {
            setAnnouncement({
              body: active.body as string,
              title: (active.title as string | null) ?? null,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setAnnouncementLoaded(true));
  }, []);

  if (loading || !session) {
    return null;
  }

  return (
    <div className="border-b border-portal-200 bg-white px-4 sm:px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {announcementLoaded && announcement && (
            <div
              className="rounded-md bg-amber-50 px-4 py-2 text-xs sm:text-sm font-medium text-amber-900 ring-1 ring-amber-200/60"
              role="banner"
              aria-live="polite"
            >
              {announcement.title ? (
                <span>
                  <span className="font-semibold">{announcement.title}: </span>
                  {announcement.body}
                </span>
              ) : (
                announcement.body
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="relative rounded-xl border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Refresh page"
          >
            <svg
              className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <NotificationCenter userEmail={session.email} />
        </div>
      </div>
    </div>
  );
}
