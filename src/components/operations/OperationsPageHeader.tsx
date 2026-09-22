"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import NotificationCenter from "@/components/NotificationCenter";

export function OperationsPageHeader({
  title,
  subtitle,
  children,
  showRefresh = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  showRefresh?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 shrink">
        <h1 className="text-xl font-bold leading-tight text-[var(--foreground)]">
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        <OperationsChromeButtons showRefresh={showRefresh} />
      </div>
    </div>
  );
}

function OperationsChromeButtons({ showRefresh }: { showRefresh: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.email) setEmail(data.session.email as string);
      })
      .catch(() => {});
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 400);
  };

  return (
    <>
      {showRefresh ? (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="relative rounded-xl border border-gray-300 bg-white p-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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
      ) : null}
      {email ? <NotificationCenter userEmail={email} /> : null}
    </>
  );
}
