"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPortalTimestamp } from "@/lib/portalTimezone";

export function TicketingSyncBar({
  lastSyncedAt,
}: {
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const runSync = async () => {
    setSyncing(true);
    setFailed(false);
    setMessage("Pulling Ticketing Raw Data…");
    try {
      const res = await fetch("/api/operations/ticketing/sync", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Sync failed");
      }
      setMessage(
        `Sync complete — ${Number(json.rowCount ?? 0).toLocaleString()} tickets`,
      );
      router.refresh();
    } catch (err) {
      setFailed(true);
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="min-w-0 text-right text-[11px] leading-tight text-[var(--muted)]">
        {lastSyncedAt ? (
          <p>Last synced: {formatPortalTimestamp(lastSyncedAt)}</p>
        ) : (
          <p>Not synced yet</p>
        )}
        {message ? (
          <p className={failed ? "text-red-600" : "text-teal-600"}>{message}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void runSync()}
        disabled={syncing}
        className="btn-primary h-9 px-3 text-xs disabled:opacity-60"
      >
        {syncing ? "Syncing…" : "Sync Data"}
      </button>
    </div>
  );
}
