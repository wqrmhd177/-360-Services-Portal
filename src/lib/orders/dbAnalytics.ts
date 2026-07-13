import { computeOperationsStatusCounts } from "@/lib/analytics/operations-status-detail";
import { computeOperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
import {
  computeAccountManagerBreakdown,
  computeCountryDeliveryRatios,
  computeDeliveryPartnerBreakdownByCountry,
  computeFulfillmentSLA,
  computeKPIs,
  computeRevenueLossBreakdown,
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
import { parseDateRange, parseFilters } from "@/lib/orders/params";
import { getOperationsStatusGroup } from "@/lib/operations/status-kpi-groups";

/**
 * Fast analytics path: filtered SQL fetch (enriched rows) + in-memory compute on subset only.
 * Replaces full-table load + imputation on every request.
 */
export async function getOperationsAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const [items, counts] = await Promise.all([
    fetchFilteredOrderLineItems(dbFilters),
    fetchOrderCounts(dbFilters),
  ]);

  return {
    range,
    filters,
    allCount: counts.allCount,
    filteredCount: counts.filteredCount,
    fulfillmentSLA: computeFulfillmentSLA(items),
    operationsStatusCounts: computeOperationsStatusCounts(items),
    revenueLossBreakdown: computeRevenueLossBreakdown(items),
    deliveryPartnerByCountry: computeDeliveryPartnerBreakdownByCountry(items),
    items,
  };
}

export async function getStoreVisibilityAnalyticsFromDb(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const range = parseDateRange(searchParams);
  const filters = parseFilters(searchParams);
  const dbFilters = searchParamsToFilterParams(searchParams, range);
  const [items, counts] = await Promise.all([
    fetchFilteredOrderLineItems(dbFilters),
    fetchOrderCounts(dbFilters),
  ]);

  return {
    range,
    filters,
    allCount: counts.allCount,
    filteredCount: counts.filteredCount,
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
