"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OrdersFilterBar from "@/components/operations/OrdersFilterBar";
import { formatPortalTimestamp } from "@/lib/portalTimezone";

type SyncJobStatus = "pending" | "running" | "success" | "failed";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
}

export function OrdersPageShell({
  children,
  searchParams,
  filterOptions,
  lastSyncedAt,
}: {
  children: React.ReactNode;
  searchParams: Record<string, string | string[] | undefined>;
  filterOptions: FilterOptions;
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const country = typeof searchParams.country === "string" ? searchParams.country : "";
  const bifurcation =
    typeof searchParams.bifurcation === "string" ? searchParams.bifurcation : "";
  const from = typeof searchParams.from === "string" ? searchParams.from : "";
  const to = typeof searchParams.to === "string" ? searchParams.to : "";

  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncJobStatus | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncing = syncStatus === "pending" || syncStatus === "running";

  const invalidateAndRefresh = useCallback(async () => {
    try {
      await fetch("/api/operations/revalidate", { method: "POST" });
    } catch {
      /* cache will expire naturally */
    }
    router.refresh();
  }, [router]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollSyncProgress = useCallback(
    (jobId?: string | null) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const url = jobId
            ? `/api/operations/orders/sync?jobId=${encodeURIComponent(jobId)}`
            : "/api/operations/orders/sync";
          const res = await fetch(url);
          const json = await res.json();
          const job = json.job;
          if (!job) return;

          setSyncJobId(job.id);
          setSyncStatus(job.status);

          if (job.progressMessage) {
            setSyncMessage(job.progressMessage);
          }

          if (job.status === "failed" && job.error) {
            setSyncMessage(job.error);
            setError(job.error);
            stopPolling();
          }

          if (job.status === "success") {
            stopPolling();
            setSyncMessage(
              `Sync complete — ${job.rowCount?.toLocaleString() ?? 0} rows`,
            );
            void invalidateAndRefresh();
          }
        } catch {
          /* keep polling */
        }
      }, 3000);
    },
    [stopPolling, invalidateAndRefresh],
  );

  const runSync = async () => {
    setSyncStatus("running");
    setSyncMessage("Starting orders sync…");
    setError(null);

    try {
      const res = await fetch("/api/operations/orders/sync", { method: "POST" });
      const json = await res.json();

      if (res.status === 409 && json.jobId) {
        setSyncJobId(json.jobId);
        setSyncStatus("running");
        setSyncMessage(json.error ?? "A sync is already in progress.");
        pollSyncProgress(json.jobId);
        return;
      }

      if (!res.ok) {
        throw new Error(json.error ?? "Sync failed");
      }

      setSyncJobId(json.jobId ?? null);

      if (json.dispatched) {
        setSyncMessage(
          json.message ??
            "Sync running on GitHub Actions — this usually takes 2–5 minutes.",
        );
        pollSyncProgress(json.jobId);
        return;
      }

      setSyncStatus("success");
      setSyncMessage(`Sync complete — ${json.rowCount?.toLocaleString() ?? 0} rows`);
      await invalidateAndRefresh();
    } catch (e) {
      stopPolling();
      setSyncStatus("failed");
      const msg = e instanceof Error ? e.message : "Sync failed";
      setError(msg);
      setSyncMessage(msg);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/operations/orders/sync");
        const json = await res.json();
        const job = json.job;
        if (!job) return;
        if (job.status === "running" || job.status === "pending") {
          setSyncStatus(job.status);
          setSyncJobId(job.id);
          setSyncMessage(
            job.progressMessage ??
              "A sync is already in progress on GitHub Actions.",
          );
          pollSyncProgress(job.id);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [pollSyncProgress]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Operations — Orders</h1>
          {lastSyncedAt ? (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Last synced: {formatPortalTimestamp(lastSyncedAt)}
            </p>
          ) : null}
          {syncMessage ? (
            <p
              className={`text-xs mt-0.5 ${
                syncStatus === "failed" ? "text-red-600" : "text-teal-600"
              }`}
            >
              {syncMessage}
              {syncing ? " — do not close this tab." : ""}
            </p>
          ) : null}
          {error && syncStatus !== "failed" ? (
            <p className="text-xs mt-0.5 text-red-600">{error}</p>
          ) : null}
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="btn-primary disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync Data"}
        </button>
      </div>

      <OrdersFilterBar
        options={filterOptions}
        country={country}
        bifurcation={bifurcation}
        from={from}
        to={to}
      />

      {children}
    </div>
  );
}
