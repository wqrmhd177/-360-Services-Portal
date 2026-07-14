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
  searchParamsToFilterParams,
} from "@/lib/orders/filteredItems";
import {
  fetchDeliveryPartnerByCountry,
  fetchFulfillmentSla,
  fetchOperationsStatusCounts,
  fetchRevenueLossBreakdown,
} from "@/lib/orders/operationsRollup";
import { parseDateRange, parseFilters } from "@/lib/orders/params";
import { getOperationsStatusGroup } from "@/lib/operations/status-kpi-groups";

/** Orders page analytics — all widgets from materialized views (no line-item load). */
export async function getOperationsAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);

  const [counts, operationsStatusCounts, revenueLossBreakdown, deliveryPartnerByCountry] =
    await Promise.all([
      fetchOrderCounts(dbFilters),
      fetchOperationsStatusCounts(dbFilters),
      fetchRevenueLossBreakdown(dbFilters),
      fetchDeliveryPartnerByCountry(dbFilters),
    ]);

  const fulfillmentSLA = await fetchFulfillmentSla(dbFilters, counts.filteredCount);

  return {
    range,
    filters,
    allCount: counts.allCount,
    filteredCount: counts.filteredCount,
    fulfillmentSLA,
    operationsStatusCounts,
    revenueLossBreakdown,
    deliveryPartnerByCountry,
  };
}

export async function getStoreVisibilityAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const [items, counts, operationsStatusCounts] = await Promise.all([
    fetchFilteredOrderLineItems(dbFilters),
    fetchOrderCounts(dbFilters),
    fetchOperationsStatusCounts(dbFilters),
  ]);

  return {
    range,
    filters,
    allCount: counts.allCount,
    filteredCount: counts.filteredCount,
    operationsStatusCounts,
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
