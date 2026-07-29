import { computeTitleDeliveryBreakdownForAccountManager } from "@/lib/analytics/orders";
import {
  fetchFilteredOrderLineItems,
  fetchOrderCounts,
  fetchCachedFilterOptionsFromDb,
  searchParamsToFilterParams,
} from "@/lib/orders/filteredItems";
import { parseDateRange, parseFilters, serializeDateRange } from "@/lib/orders/params";
import {
  fetchDeliveryPartnerByCountry,
  fetchOperationsStatusCounts,
  fetchRevenueLossBreakdown,
  mapSlaRollupRows,
} from "@/lib/orders/operationsRollup";
import { fetchOrdersRollupRows } from "@/lib/orders/rollupQuery";
import { fetchOperationsStatusDetail } from "@/lib/orders/statusDetailRollup";
import { fetchStoreVisibilityTables } from "@/lib/orders/storeVisibilityRollup";
import { getLastSync } from "@/lib/operations/opsDb";
import type { OperationsStatusGroupId } from "@/lib/operations/status-kpi-groups";

/** Orders page analytics — all widgets from materialized views (no line-item load). */
export async function getOperationsAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);

  type SlaRollupRow = {
    country: string | null;
    confirm_days_sum: number | null;
    confirm_count: number | null;
    deliver_days_sum: number | null;
    deliver_count: number | null;
    return_days_sum: number | null;
    return_count: number | null;
    ship_days_sum: number | null;
    ship_count: number | null;
    shipped_within_48h_count: number | null;
  };

  const [
    counts,
    operationsStatusCounts,
    revenueLossBreakdown,
    deliveryPartnerByCountry,
    slaRows,
    filterOptions,
    lastSync,
  ] = await Promise.all([
    fetchOrderCounts(dbFilters),
    fetchOperationsStatusCounts(dbFilters),
    fetchRevenueLossBreakdown(dbFilters),
    fetchDeliveryPartnerByCountry(dbFilters),
    fetchOrdersRollupRows<SlaRollupRow>(
      "ops_orders_sla_rollup",
      dbFilters,
      "country, confirm_days_sum, confirm_count, deliver_days_sum, deliver_count, return_days_sum, return_count, ship_days_sum, ship_count, shipped_within_48h_count",
    ),
    fetchCachedFilterOptionsFromDb(),
    getLastSync("orders"),
  ]);

  const fulfillmentSLA = mapSlaRollupRows(slaRows, counts.filteredCount);

  const statusCounts = {
    ...operationsStatusCounts,
    totalOrders: counts.filteredCount,
  };

  return {
    range,
    filters,
    filteredCount: counts.filteredCount,
    lastSyncedAt: lastSync?.synced_at ?? null,
    fulfillmentSLA,
    operationsStatusCounts: statusCounts,
    revenueLossBreakdown,
    deliveryPartnerByCountry,
    filterOptions: {
      countries: filterOptions.countries,
      bifurcations: filterOptions.bifurcations,
    },
  };
}

export async function getStoreVisibilityAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const [storeTables, counts, operationsStatusCounts, filterOptions, lastSync] =
    await Promise.all([
      fetchStoreVisibilityTables(dbFilters),
      fetchOrderCounts(dbFilters),
      fetchOperationsStatusCounts(dbFilters),
      fetchCachedFilterOptionsFromDb(),
      getLastSync("orders"),
    ]);

  const statusCounts = {
    ...operationsStatusCounts,
    totalOrders: counts.filteredCount,
  };

  const { from, to } = serializeDateRange(range);

  return {
    range,
    filters,
    filteredCount: counts.filteredCount,
    lastSyncedAt: lastSync?.synced_at ?? null,
    rangeLabel: `${from} – ${to}`,
    operationsStatusCounts: statusCounts,
    filterOptions: {
      countries: filterOptions.countries,
      bifurcations: filterOptions.bifurcations,
      storeIds: filterOptions.storeIds,
      storeOptions: filterOptions.storeOptions,
    },
    storeTables,
  };
}

export async function getOperationsStatusDetailFromDb(
  searchParams: Record<string, string | string[] | undefined>,
  groupId: string,
) {
  const range = parseDateRange(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const detail = await fetchOperationsStatusDetail(
    dbFilters,
    groupId as OperationsStatusGroupId,
  );

  return { group: groupId, range, detail };
}

export async function getAccountManagerDetailFromDb(
  searchParams: Record<string, string | string[] | undefined>,
  accountManagerName: string,
) {
  const range = parseDateRange(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const items = await fetchFilteredOrderLineItems(dbFilters);
  const titles = computeTitleDeliveryBreakdownForAccountManager(items, accountManagerName);

  return { accountManager: accountManagerName, range, titles };
}
