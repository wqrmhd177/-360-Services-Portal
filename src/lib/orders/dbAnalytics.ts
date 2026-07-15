import { computeOperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
import { computeStoreVisibilityTables } from "@/lib/analytics/store-visibility";
import {
  computeAccountManagerBreakdown,
  computeCountryDeliveryRatios,
  computeKPIs,
  computeStatusBreakdown,
  computeTitleBreakdown,
  computeTitleDeliveryBreakdownForAccountManager,
  computeTrends,
} from "@/lib/analytics/orders";
import {
  fetchFilteredOrderLineItems,
  fetchOrderCounts,
  fetchOrderCountDiagnostics,
  fetchCachedFilterOptionsFromDb,
  searchParamsToFilterParams,
} from "@/lib/orders/filteredItems";
import {
  fetchDeliveryPartnerByCountry,
  fetchOperationsStatusCounts,
  fetchRevenueLossBreakdown,
  mapSlaRollupRows,
} from "@/lib/orders/operationsRollup";
import { fetchOrdersRollupRows } from "@/lib/orders/rollupQuery";
import { parseDateRange, parseFilters } from "@/lib/orders/params";
import { getOperationsStatusGroup } from "@/lib/operations/status-kpi-groups";

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
    diagnostics,
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
    fetchOrderCountDiagnostics(dbFilters),
  ]);

  const rollupVsRpcDelta =
    operationsStatusCounts.totalOrders - counts.filteredCount;

  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/d1ead4db-e7ce-43dc-9e13-a703fdb1f6ba", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "75f7fa",
    },
    body: JSON.stringify({
      sessionId: "75f7fa",
      runId: "pre-fix",
      hypothesisId: "H1-H5",
      location: "dbAnalytics.ts:getOperationsAnalyticsFromDb",
      message: "portal count comparison",
      data: {
        dbFilters,
        filteredCount: counts.filteredCount,
        allCount: counts.allCount,
        statusRollupTotal: operationsStatusCounts.totalOrders,
        deliveredRollup: operationsStatusCounts.deliveredOrders,
        rollupVsRpcDelta,
        diagnostics,
        excelExpectedTotal: 22922,
        portalReportedGap: 22922 - operationsStatusCounts.totalOrders,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const fulfillmentSLA = mapSlaRollupRows(slaRows, counts.filteredCount);

  const statusCounts = {
    ...operationsStatusCounts,
    totalOrders: counts.filteredCount,
  };

  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/d1ead4db-e7ce-43dc-9e13-a703fdb1f6ba", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "75f7fa",
    },
    body: JSON.stringify({
      sessionId: "75f7fa",
      runId: "post-fix",
      hypothesisId: "H3",
      location: "dbAnalytics.ts:getOperationsAnalyticsFromDb",
      message: "total orders source after fix",
      data: {
        filteredCount: counts.filteredCount,
        rollupSumBeforeOverride: operationsStatusCounts.totalOrders,
        totalOrdersReturned: statusCounts.totalOrders,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return {
    range,
    filters,
    allCount: counts.allCount,
    filteredCount: counts.filteredCount,
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
  const [items, counts, operationsStatusCounts, filterOptions] = await Promise.all([
    fetchFilteredOrderLineItems(dbFilters),
    fetchOrderCounts(dbFilters),
    fetchOperationsStatusCounts(dbFilters),
    fetchCachedFilterOptionsFromDb(),
  ]);

  const statusCounts = {
    ...operationsStatusCounts,
    totalOrders: counts.filteredCount,
  };

  return {
    range,
    filters,
    allCount: counts.allCount,
    filteredCount: counts.filteredCount,
    operationsStatusCounts: statusCounts,
    filterOptions: {
      countries: filterOptions.countries,
      bifurcations: filterOptions.bifurcations,
      storeIds: filterOptions.storeIds,
      storeOptions: filterOptions.storeOptions,
    },
    storeTables: computeStoreVisibilityTables(items),
    kpis: computeKPIs(items),
    trends: computeTrends(items, range),
    statusBreakdown: computeStatusBreakdown(items),
    countryDeliveryRatios: computeCountryDeliveryRatios(items),
    accountManagerBreakdown: computeAccountManagerBreakdown(items),
    titleBreakdown: computeTitleBreakdown(items),
  };
}

export async function getOperationsStatusDetailFromDb(
  searchParams: Record<string, string | string[] | undefined>,
  groupId: string,
) {
  const group = getOperationsStatusGroup(groupId);
  if (!group) {
    throw new Error(`Unknown group: ${groupId}`);
  }

  const range = parseDateRange(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const items = await fetchFilteredOrderLineItems(dbFilters);
  const detail = computeOperationsStatusOrderDetail(items, group);

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
