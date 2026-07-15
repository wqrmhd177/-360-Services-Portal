import { filterOrders, applyOrderLevelFacetFilters, groupByOrder } from "@/lib/analytics/orders";
import { applyRevenueImputation } from "@/lib/analytics/revenue-imputation";
import { getOpsDb } from "@/lib/operations/opsDb";
import { getAllOrderLineItems } from "@/lib/orders/lineItems";
import type { OrderLineItem } from "@/lib/types/order";
import { unstable_cache } from "next/cache";

export type OrdersFilterParams = {
  country?: string | null;
  bifurcation?: string | null;
  storeId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
};

/** Treat blank strings as "no filter" so RPCs do not match empty facet values only. */
export function normalizeOptionalFilter(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toRpcFilterParams(filters: OrdersFilterParams) {
  return {
    p_country: normalizeOptionalFilter(filters.country),
    p_bifurcation: normalizeOptionalFilter(filters.bifurcation),
    p_store_id: filters.storeId ?? null,
    p_from_date: normalizeOptionalFilter(filters.fromDate),
    p_to_date: normalizeOptionalFilter(filters.toDate),
  };
}

function applyFacetFilters(
  items: OrderLineItem[],
  filters: OrdersFilterParams,
): OrderLineItem[] {
  return applyOrderLevelFacetFilters(items, {
    country: normalizeOptionalFilter(filters.country),
    bifurcation: normalizeOptionalFilter(filters.bifurcation),
  });
}

type DbOrderRow = {
  order_id: number | null;
  order_number: string | null;
  domain: string | null;
  store_id: number | null;
  store_url: string | null;
  country: string | null;
  city: string | null;
  full_name: string | null;
  title: string | null;
  sku: string | null;
  quantity: number | null;
  total_payable: number | null;
  currency: string | null;
  status: string | null;
  substatus: string | null;
  tag: string | null;
  bifurcation: string | null;
  delivery_partner: string | null;
  platform: string | null;
  order_date: string | null;
  approved_date: string | null;
  shipment_date: string | null;
  shipment_date_log: string | null;
  delivered_date: string | null;
  returned_date: string | null;
  undelivered_date: string | null;
  resolved_payable: number | null;
  payable_estimated: boolean | null;
  usd_revenue: number | null;
  account_manager_key: string | null;
  order_date_day: string | null;
};

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapEnrichedDbRowToOrderLineItem(row: DbOrderRow): OrderLineItem | null {
  const orderDate = parseDate(row.order_date);
  if (!orderDate) return null;

  const resolvedPayable = Number(row.resolved_payable ?? row.total_payable ?? 0);
  const accountManager =
    row.account_manager_key?.trim() ||
    row.domain?.trim() ||
    row.store_url?.trim() ||
    (row.store_id != null ? `Store ${row.store_id}` : "Unknown");

  return {
    metabaseId: Number(row.order_id ?? 0),
    orderNumber: row.order_number ?? "",
    country: row.country ?? "",
    fullName: row.full_name ?? "",
    phone: "",
    shipping: "",
    city: row.city ?? "",
    title: row.title ?? "",
    sku: row.sku ?? "",
    quantity: Number(row.quantity ?? 1),
    totalPayable: Number(row.total_payable ?? 0),
    resolvedPayable,
    payableEstimated: Boolean(row.payable_estimated),
    status: row.status ?? "",
    substatus: row.substatus ?? "",
    tag: row.tag ?? "",
    opRemarks: "",
    bifurcation: row.bifurcation ?? "",
    platform: row.platform ?? "",
    accountManager,
    deliveryPartner: row.delivery_partner ?? "",
    undeliveredTag: null,
    courierTrackingId: "",
    orderDate,
    deliveredDate: parseDate(row.delivered_date),
    shipmentDate: parseDate(row.shipment_date),
    shipmentDateLog: parseDate(row.shipment_date_log),
    approvedDate: parseDate(row.approved_date),
    undeliveredDate: parseDate(row.undelivered_date),
    rescheduleDate: null,
    returnedDate: parseDate(row.returned_date),
    updateUser: null,
    storeId: Number(row.store_id ?? 0),
    currencyCode: row.currency?.trim() || undefined,
  };
}

export async function fetchFilteredOrderLineItems(
  filters: OrdersFilterParams,
): Promise<OrderLineItem[]> {
  const supabase = getOpsDb();
  const rpcParams = toRpcFilterParams(filters);
  const pageSize = 1000;
  let offset = 0;
  const allRows: DbOrderRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .rpc("get_ops_orders_filtered_enriched", rpcParams)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) break;
    if (!data?.length) {
      if (offset === 0) {
        // Fallback before setup_orders_analytics_cache.sql is applied
        return fetchFilteredOrderLineItemsFallback(filters);
      }
      break;
    }

    allRows.push(...(data as DbOrderRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (allRows.length > 0) {
    const items = allRows
      .map(mapEnrichedDbRowToOrderLineItem)
      .filter((item): item is OrderLineItem => item != null);
    return applyFacetFilters(items, filters);
  }

  return fetchFilteredOrderLineItemsFallback(filters);
}

async function fetchFilteredOrderLineItemsFallback(
  filters: OrdersFilterParams,
): Promise<OrderLineItem[]> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc(
    "get_ops_orders_filtered_enriched",
    toRpcFilterParams(filters),
  );

  if (!error && data) {
    const rows = data as DbOrderRow[];
    const items = rows
      .map(mapEnrichedDbRowToOrderLineItem)
      .filter((item): item is OrderLineItem => item != null);
    return applyFacetFilters(items, filters);
  }

  // Fallback before setup_orders_analytics_cache.sql is applied
  const allItems = applyRevenueImputation(await getAllOrderLineItems());
  if (!filters.fromDate || !filters.toDate) {
    return applyFacetFilters(allItems, filters);
  }

  const range = {
    from: new Date(`${filters.fromDate}T00:00:00`),
    to: new Date(`${filters.toDate}T23:59:59.999`),
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  };

  const dateFiltered = filterOrders(allItems, range, {
    storeIds: filters.storeId ? [filters.storeId] : undefined,
  });

  const country = normalizeOptionalFilter(filters.country);
  const bifurcation = normalizeOptionalFilter(filters.bifurcation);

  return applyOrderLevelFacetFilters(dateFiltered, { country, bifurcation });
}

export type StoreFilterOption = {
  id: number;
  label: string;
};

function formatStoreLabel(id: number, storeUrl?: string | null): string {
  const url = storeUrl?.trim();
  return url ? `${id} — ${url}` : String(id);
}

async function fetchStoreOptionsFromDb(): Promise<StoreFilterOption[]> {
  const supabase = getOpsDb();
  const pageSize = 1000;
  let offset = 0;
  const byId = new Map<number, string>();

  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("store_id, store_url")
      .not("store_id", "is", null)
      .gt("store_id", 0)
      .range(offset, offset + pageSize - 1);

    if (error || !data?.length) break;

    for (const row of data as { store_id: number | null; store_url: string | null }[]) {
      const id = Number(row.store_id ?? 0);
      if (id <= 0 || byId.has(id)) continue;
      byId.set(id, formatStoreLabel(id, row.store_url));
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...byId.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.id - b.id);
}

function buildStoreOptionsFromItems(items: OrderLineItem[]): StoreFilterOption[] {
  const byId = new Map<number, string>();
  for (const item of items) {
    if (item.storeId <= 0 || byId.has(item.storeId)) continue;
    byId.set(item.storeId, String(item.storeId));
  }
  return [...byId.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.id - b.id);
}

export async function fetchOrderCounts(filters: OrdersFilterParams): Promise<{
  allCount: number;
  filteredCount: number;
}> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc(
    "get_ops_orders_counts",
    toRpcFilterParams(filters),
  );

  if (!error && data) {
    const payload = data as { allCount?: number; filteredCount?: number };
    return {
      allCount: Number(payload.allCount ?? 0),
      filteredCount: Number(payload.filteredCount ?? 0),
    };
  }

  const allItems = await getAllOrderLineItems();
  const allCount = groupByOrder(allItems).size;
  const items = await fetchFilteredOrderLineItems(filters);
  return { allCount, filteredCount: groupByOrder(items).size };
}

export async function fetchFilterOptionsFromDb(): Promise<{
  countries: string[];
  bifurcations: string[];
  storeIds: number[];
  storeOptions: StoreFilterOption[];
}> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_orders_filter_options_v2");

  if (!error && data) {
    const payload = data as {
      countries?: string[];
      bifurcations?: string[];
      storeIds?: number[];
    };

    const storeIds = (payload.storeIds ?? []).map(Number).filter((n) => n > 0);
    const storeOptionsFromDb = await fetchStoreOptionsFromDb();
    const storeOptions =
      storeOptionsFromDb.length > 0
        ? storeOptionsFromDb
        : storeIds.map((id) => ({ id, label: String(id) }));

    return {
      countries: payload.countries ?? [],
      bifurcations: payload.bifurcations ?? [],
      storeIds,
      storeOptions,
    };
  }

  const allItems = applyRevenueImputation(await getAllOrderLineItems());
  const countries = [...new Set(allItems.map((i) => i.country).filter(Boolean))].sort();
  const bifurcations = [...new Set(allItems.map((i) => i.bifurcation).filter(Boolean))].sort();
  const storeOptions = buildStoreOptionsFromItems(allItems);
  const storeIds = storeOptions.map((opt) => opt.id);
  return { countries, bifurcations, storeIds, storeOptions };
}

/** Cached filter options — countries/bifurcations change only after sync. */
export const fetchCachedFilterOptionsFromDb = unstable_cache(
  async () => fetchFilterOptionsFromDb(),
  ["ops-orders-filter-options"],
  { revalidate: 3600, tags: ["ops-orders-filter-options"] },
);

export function searchParamsToFilterParams(
  searchParams: Record<string, string | string[] | undefined>,
  range: { fromDate: string; toDate: string },
): OrdersFilterParams {
  const country =
    typeof searchParams.country === "string" ? searchParams.country : null;
  const bifurcation =
    typeof searchParams.bifurcation === "string" ? searchParams.bifurcation : null;
  const storeRaw =
    typeof searchParams.store_id === "string" ? searchParams.store_id : null;
  const storeId = storeRaw ? Number(storeRaw) : null;

  return {
    country: normalizeOptionalFilter(country),
    bifurcation: normalizeOptionalFilter(bifurcation),
    storeId: storeId && Number.isFinite(storeId) ? storeId : null,
    fromDate: range.fromDate,
    toDate: range.toDate,
  };
}
