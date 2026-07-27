"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SkuPerformanceFilterBar, {
  useDefaultSkuPerformanceDateRange,
} from "@/components/operations/SkuPerformanceFilterBar";
import { SkuPerformanceTable } from "@/components/operations/SkuPerformanceTable";
import { ListPagination } from "@/components/lists/ListPagination";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import {
  formatPstTimestamp,
  type SkuPerformanceRow,
} from "@/lib/operations/skuPerformance";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
}

function SkuPerformanceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  useDefaultSkuPerformanceDateRange();

  const country = sp.get("country") ?? "";
  const bifurcation = sp.get("bifurcation") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const search = sp.get("search") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    countries: [],
    bifurcations: [],
  });
  const [rows, setRows] = useState<SkuPerformanceRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [mvRefreshedAt, setMvRefreshedAt] = useState<string | null>(null);
  const [inventoryRefreshedAt, setInventoryRefreshedAt] = useState<string | null>(null);
  const [inventoryWarning, setInventoryWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRangeReady = Boolean(from && to);

  const filterQuery = (() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (bifurcation) params.set("bifurcation", bifurcation);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("search", search);
    return params.toString();
  })();

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/sku-performance/filter-options", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setFilterOpts({
          countries: json.countries ?? [],
          bifurcations: json.bifurcations ?? [],
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!dateRangeReady) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(filterQuery);
      params.set("page", String(page));
      params.set("page_size", "20");
      params.set("sort_by", "approved_quantity");
      params.set("sort_direction", "desc");

      const res = await fetch(`/api/operations/sku-performance?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load SKU performance");

      setRows(json.data ?? []);
      setTotalRecords(json.pagination?.total_records ?? 0);
      setTotalPages(json.pagination?.total_pages ?? 1);
      setMvRefreshedAt(json.data_freshness?.mv_refreshed_at ?? null);
      setInventoryRefreshedAt(json.data_freshness?.inventory_refreshed_at ?? null);
      setInventoryWarning(json.inventory_warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SKU performance");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateRangeReady, filterQuery, page]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePageChange = (nextPage: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  if (!dateRangeReady) {
    return <PortalPageLoading label="Loading SKU Performance…" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">SKU Performance</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Order metrics by SKU with seller breakdown. All Operations dates use PST.
        </p>
      </div>

      <SkuPerformanceFilterBar options={filterOpts} />

      <div className="space-y-1 text-xs text-[var(--muted)]">
        {mvRefreshedAt ? (
          <p>Orders data refreshed: {formatPstTimestamp(mvRefreshedAt)}</p>
        ) : null}
        {inventoryRefreshedAt ? (
          <p>Inventory synced: {formatPstTimestamp(inventoryRefreshedAt)}</p>
        ) : null}
        {inventoryWarning ? (
          <p className="text-amber-600">{inventoryWarning}</p>
        ) : null}
      </div>

      {loading ? (
        <PortalPageLoading label="Loading SKU data…" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
          <button type="button" onClick={loadData} className="ml-3 underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          <SkuPerformanceTable rows={rows} filterQuery={filterQuery} />
          <ListPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalRecords}
            itemLabel="SKUs"
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}

export default function SkuPerformancePage() {
  return (
    <Suspense fallback={<PortalPageLoading label="Loading SKU Performance…" />}>
      <SkuPerformanceContent />
    </Suspense>
  );
}
