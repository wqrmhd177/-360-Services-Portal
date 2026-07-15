"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OperationsStatusKpis } from "@/components/orders/operations-status-kpis";
import { StoreVisibilityTablesSection } from "@/components/orders/store-visibility-tables-section";
import OrdersFilterBar, {
  useDefaultOrdersDateRange,
} from "@/components/operations/OrdersFilterBar";
import type { StoreOption } from "@/components/operations/StoreIdSearchSelect";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import type { OperationsStatusCounts } from "@/lib/analytics/operations-status-detail";
import type { StoreVisibilityTables } from "@/lib/analytics/store-visibility";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
  storeIds: number[];
  storeOptions: StoreOption[];
}

interface StoreAnalyticsData {
  rangeLabel: string;
  operationsStatusCounts: OperationsStatusCounts;
  storeTables: StoreVisibilityTables;
}

function StoreVisibilityContent() {
  const sp = useSearchParams();
  useDefaultOrdersDateRange();
  const country = sp.get("country") ?? "";
  const bifurcation = sp.get("bifurcation") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const storeId = sp.get("store_id") ?? "";

  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    countries: [],
    bifurcations: [],
    storeIds: [],
    storeOptions: [],
  });
  const [data, setData] = useState<StoreAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateRangeReady = Boolean(from && to);

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/orders/filter-options", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setFilterOpts({
          countries: json.countries ?? [],
          bifurcations: json.bifurcations ?? [],
          storeIds: json.storeIds ?? [],
          storeOptions: json.storeOptions ?? [],
        });
      }
    } catch {
      /* fallback: options also arrive with analytics payload */
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!dateRangeReady) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (country) params.set("country", country);
      if (bifurcation) params.set("bifurcation", bifurcation);
      if (storeId) params.set("store_id", storeId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/operations/store-visibility/analytics?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
      if (json.filteredCount === 0 && json.allCount === 0) {
        setError("empty");
        setData(null);
        return;
      }

      if (json.filterOptions) {
        setFilterOpts({
          countries: json.filterOptions.countries ?? [],
          bifurcations: json.filterOptions.bifurcations ?? [],
          storeIds: json.filterOptions.storeIds ?? [],
          storeOptions: json.filterOptions.storeOptions ?? [],
        });
      }

      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [country, bifurcation, storeId, from, to, dateRangeReady]);

  useEffect(() => {
    if (!dateRangeReady) return;
    loadAnalytics();
  }, [loadAnalytics, dateRangeReady]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Operations — Store Visibility
        </h1>
      </div>

      <OrdersFilterBar
        options={filterOpts}
        country={country}
        bifurcation={bifurcation}
        from={from}
        to={to}
        storeId={storeId}
        showStoreFilter
      />

      {loading ? <PortalPageLoading label="Loading store visibility" /> : null}

      {!loading && error === "empty" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-900">
          No data matches the current filters. Sync orders data from the Orders page first.
        </div>
      ) : null}

      {!loading && error && error !== "empty" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <OperationsStatusKpis
            counts={data.operationsStatusCounts}
            rangeLabel={data.rangeLabel}
          />
          <StoreVisibilityTablesSection
            tables={data.storeTables}
            storeId={storeId || undefined}
          />
        </>
      ) : null}
    </div>
  );
}

export default function StoreVisibilityPage() {
  return (
    <Suspense fallback={<PortalPageLoading label="Loading" />}>
      <StoreVisibilityContent />
    </Suspense>
  );
}
