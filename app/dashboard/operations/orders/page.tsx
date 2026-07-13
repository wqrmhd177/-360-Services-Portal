"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DeliveryPartnerChartCard } from "@/components/orders/delivery-partner-chart-card";
import { OperationsSlaKpis } from "@/components/orders/operations-sla-kpis";
import { OperationsStatusKpis } from "@/components/orders/operations-status-kpis";
import { RevenueLossTable } from "@/components/orders/revenue-loss-table";
import OrdersFilterBar, {
  useDefaultOrdersDateRange,
} from "@/components/operations/OrdersFilterBar";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import type {
  DeliveryPartnerByCountryData,
  FulfillmentSLA,
  RevenueLossRow,
} from "@/lib/analytics/orders";
import type { OperationsStatusCounts } from "@/lib/analytics/operations-status-detail";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
}

interface AnalyticsPayload {
  rangeLabel: string;
  fulfillmentSLA: FulfillmentSLA;
  operationsStatusCounts: OperationsStatusCounts;
  revenueLossBreakdown: RevenueLossRow[];
  deliveryPartnerByCountry: DeliveryPartnerByCountryData;
  lastSyncedAt: string | null;
}

type SyncJobStatus = "pending" | "running" | "success" | "failed";

function OrdersOperationsContent() {
  const sp = useSearchParams();
  useDefaultOrdersDateRange();
  const country = sp.get("country") ?? "";
  const bifurcation = sp.get("bifurcation") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    countries: [],
    bifurcations: [],
  });
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncJobStatus | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncing = syncStatus === "pending" || syncStatus === "running";

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/orders/filter-options");
      if (res.ok) setFilterOpts(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (country) params.set("country", country);
      if (bifurcation) params.set("bifurcation", bifurcation);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/operations/orders/analytics?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
      if (json.filteredCount === 0 && json.allCount === 0) {
        setError("empty");
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [country, bifurcation, from, to]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollSyncProgress = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/operations/orders/sync");
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
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
  }, [stopPolling]);

  const runSync = async () => {
    setSyncStatus("running");
    setSyncMessage(
      "Syncing from Metabase… this usually takes 2–5 minutes. Please keep this tab open.",
    );
    setError(null);
    pollSyncProgress();

    try {
      const res = await fetch("/api/operations/orders/sync", { method: "POST" });
      const json = await res.json();
      stopPolling();

      if (!res.ok) {
        throw new Error(json.error ?? "Sync failed");
      }

      setSyncStatus("success");
      setSyncMessage(`Sync complete — ${json.rowCount?.toLocaleString() ?? 0} rows`);
      await loadFilterOptions();
      await loadAnalytics();
    } catch (e) {
      setSyncStatus("failed");
      const msg = e instanceof Error ? e.message : "Sync failed";
      setError(msg);
      setSyncMessage(msg);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/operations/orders/sync");
        const json = await res.json();
        const job = json.job;
        if (!job) return;
        if (job.status === "running" || job.status === "pending") {
          setSyncStatus(job.status);
          setSyncMessage(
            job.progressMessage ??
              "A sync is already in progress. Wait or click Sync Data to retry.",
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Operations — Orders</h1>
          {data?.lastSyncedAt ? (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Last synced: {new Date(data.lastSyncedAt).toLocaleString()}
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
        options={filterOpts}
        country={country}
        bifurcation={bifurcation}
        from={from}
        to={to}
      />

      {loading ? <PortalPageLoading label="Loading operations analytics" /> : null}

      {!loading && error === "empty" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-sm font-medium text-amber-900">
            No orders data yet. Click Sync Data to load from Metabase.
          </p>
          <button onClick={runSync} disabled={syncing} className="btn-primary mt-4">
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      ) : null}

      {!loading && error && error !== "empty" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && data ? (
        <section className="space-y-6">
          <OperationsSlaKpis sla={data.fulfillmentSLA} rangeLabel={data.rangeLabel} />
          <OperationsStatusKpis
            counts={data.operationsStatusCounts}
            rangeLabel={data.rangeLabel}
          />
          <DeliveryPartnerChartCard data={data.deliveryPartnerByCountry} />
          <RevenueLossTable title="Revenue Loss" rows={data.revenueLossBreakdown} />
        </section>
      ) : null}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<PortalPageLoading label="Loading" />}>
      <OrdersOperationsContent />
    </Suspense>
  );
}
