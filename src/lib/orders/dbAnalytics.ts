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
  fetchFulfillmentSlaFromDb,
  fetchOperationsStatusCounts,
  fetchRevenueLossBreakdown,
} from "@/lib/orders/operationsRollup";
import { fetchOperationsStatusDetail } from "@/lib/orders/statusDetailRollup";
import { fetchStoreVisibilityTables } from "@/lib/orders/storeVisibilityRollup";
import { getLastSync } from "@/lib/operations/opsDb";
import type { OperationsStatusGroupId } from "@/lib/operations/status-kpi-groups";

/** Fastest: status KPI cards only. */
export async function getOperationsStatusKpisFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);

  const [counts, operationsStatusCounts] = await Promise.all([
    fetchOrderCounts(dbFilters),
    fetchOperationsStatusCounts(dbFilters),
  ]);

  return {
    range,
    filters,
    filteredCount: counts.filteredCount,
    operationsStatusCounts: {
      ...operationsStatusCounts,
      totalOrders: counts.filteredCount,
    },
  };
}

/** SLA KPI cards (may be slower without summary RPC). */
export async function getOperationsSlaFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const counts = await fetchOrderCounts(dbFilters);
  const fulfillmentSLA = await fetchFulfillmentSlaFromDb(
    dbFilters,
    counts.filteredCount,
  );

  return {
    range,
    filters,
    filteredCount: counts.filteredCount,
    fulfillmentSLA,
  };
}

/** Fast path: SLA + status KPI cards. */
export async function getOperationsKpisFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const [status, sla] = await Promise.all([
    getOperationsStatusKpisFromDb(searchParams),
    getOperationsSlaFromDb(searchParams),
  ]);

  return {
    ...status,
    fulfillmentSLA: sla.fulfillmentSLA,
  };
}

/** Slower charts: delivery partner + revenue loss. */
export async function getOperationsChartsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);

  const [counts, revenueLossBreakdown, deliveryPartnerByCountry] = await Promise.all([
    fetchOrderCounts(dbFilters),
    fetchRevenueLossBreakdown(dbFilters),
    fetchDeliveryPartnerByCountry(dbFilters),
  ]);

  return {
    range,
    filters,
    filteredCount: counts.filteredCount,
    revenueLossBreakdown,
    deliveryPartnerByCountry,
  };
}

/** Orders page analytics — combined (API route). */
export async function getOperationsAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const [kpis, charts, filterOptions, lastSync] = await Promise.all([
    getOperationsKpisFromDb(searchParams),
    getOperationsChartsFromDb(searchParams),
    fetchCachedFilterOptionsFromDb(),
    getLastSync("orders"),
  ]);

  return {
    ...kpis,
    ...charts,
    lastSyncedAt: lastSync?.synced_at ?? null,
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
