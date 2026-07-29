import { unstable_cache, revalidateTag } from "next/cache";
import { getOperationsAnalyticsFromDb, getStoreVisibilityAnalyticsFromDb } from "@/lib/orders/dbAnalytics";
import { getSkuPerformanceSummary } from "@/lib/operations/skuPerformance";
import type { SkuPerformanceFilters } from "@/lib/operations/skuPerformance";
import { fetchOperationsStatusDetail } from "@/lib/orders/statusDetailRollup";
import { searchParamsToFilterParams } from "@/lib/orders/filteredItems";
import { parseDateRange } from "@/lib/orders/params";
import type { OperationsStatusGroupId } from "@/lib/operations/status-kpi-groups";

export const OPS_DATA_TAG = "ops-data";
export const OPS_FILTER_OPTIONS_TAG = "ops-orders-filter-options";

export function invalidateOpsDataCache() {
  revalidateTag(OPS_DATA_TAG);
  revalidateTag(OPS_FILTER_OPTIONS_TAG);
}

function stableParamsKey(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const pick = (key: string) => {
    const v = searchParams[key];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  return [
    pick("country"),
    pick("bifurcation"),
    pick("from"),
    pick("to"),
    pick("store_id"),
  ].join("|");
}

export async function getOperationsAnalyticsCached(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const key = stableParamsKey(searchParams);
  const cached = unstable_cache(
    () => getOperationsAnalyticsFromDb(searchParams),
    ["ops-analytics", key],
    { revalidate: 3600, tags: [OPS_DATA_TAG] },
  );
  return cached();
}

export async function getSkuPerformanceSummaryCached(params: {
  filters: SkuPerformanceFilters;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}) {
  const f = params.filters;
  const key = [
    f.country ?? "",
    f.bifurcation ?? "",
    f.fromDate ?? "",
    f.toDate ?? "",
    f.search ?? "",
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.sortBy ?? "approved_quantity",
    params.sortDirection ?? "desc",
  ].join("|");

  const cached = unstable_cache(
    () => getSkuPerformanceSummary(params),
    ["sku-performance", key],
    { revalidate: 3600, tags: [OPS_DATA_TAG] },
  );
  return cached();
}

export async function getStoreVisibilityAnalyticsCached(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const key = stableParamsKey(searchParams);
  const cached = unstable_cache(
    () => getStoreVisibilityAnalyticsFromDb(searchParams),
    ["store-visibility", key],
    { revalidate: 3600, tags: [OPS_DATA_TAG] },
  );
  return cached();
}

export async function getOperationsStatusDetailCached(
  searchParams: Record<string, string | string[] | undefined>,
  groupId: OperationsStatusGroupId,
) {
  const key = `${stableParamsKey(searchParams)}|${groupId}`;
  const range = parseDateRange(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const cached = unstable_cache(
    () => fetchOperationsStatusDetail(dbFilters, groupId),
    ["ops-status-detail", key],
    { revalidate: 3600, tags: [OPS_DATA_TAG] },
  );
  return cached();
}
