import { getLastSync, getOpsDb } from "@/lib/operations/opsDb";
import { normalizeOptionalFilter } from "@/lib/orders/filteredItems";

export type SkuPerformanceFilters = {
  country?: string | null;
  bifurcation?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
};

export type SkuPerformanceRow = {
  product_title: string;
  sku: string;
  approved_quantity: number;
  dispatched_quantity: number;
  delivered_quantity: number;
  dispatch_to_delivery_pct: number | null;
  weighted_average: number | null;
  available_inventory: number | null;
  seller_count: number;
};

export type SkuSellerRow = {
  user_id: number | null;
  store_id: number;
  store_name: string | null;
  approved_quantity: number;
  dispatched_quantity: number;
  delivered_quantity: number;
  dispatch_to_delivery_pct: number | null;
  weighted_average: number | null;
};

type RpcSummaryPayload = {
  data?: SkuPerformanceRow[];
  total_records?: number;
  mv_refreshed_at?: string | null;
};

type RpcSellersPayload = {
  data?: SkuSellerRow[];
  total_records?: number;
};

function toSummaryRpcFilters(filters: SkuPerformanceFilters) {
  return {
    p_country: normalizeOptionalFilter(filters.country),
    p_bifurcation: normalizeOptionalFilter(filters.bifurcation),
    p_from_date: normalizeOptionalFilter(filters.fromDate),
    p_to_date: normalizeOptionalFilter(filters.toDate),
    p_search: normalizeOptionalFilter(filters.search),
  };
}

function toSellerRpcFilters(filters: SkuPerformanceFilters) {
  return {
    p_country: normalizeOptionalFilter(filters.country),
    p_bifurcation: normalizeOptionalFilter(filters.bifurcation),
    p_from_date: normalizeOptionalFilter(filters.fromDate),
    p_to_date: normalizeOptionalFilter(filters.toDate),
  };
}

async function fetchInventoryBySkus(
  skus: string[],
  country: string | null,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (skus.length === 0) return result;

  const supabase = getOpsDb();
  const normalized = skus.map((s) => s.toUpperCase().trim());

  let query = supabase
    .from("ops_inventory_items")
    .select("sku, available_quantity, country")
    .in("sku", normalized);

  if (country) {
    query = query.eq("country", country);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const sku = String(row.sku ?? "").toUpperCase().trim();
    if (!sku) continue;
    const qty = Number(row.available_quantity) || 0;
    result.set(sku, (result.get(sku) ?? 0) + qty);
  }

  return result;
}

export async function getSkuPerformanceSummary(params: {
  filters: SkuPerformanceFilters;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}): Promise<{
  data: SkuPerformanceRow[];
  totalRecords: number;
  totalPages: number;
  mvRefreshedAt: string | null;
  inventoryRefreshedAt: string | null;
  inventoryWarning: string | null;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const rpcFilters = toSummaryRpcFilters(params.filters);

  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_sku_performance_summary", {
    ...rpcFilters,
    p_sort_by: params.sortBy ?? "approved_quantity",
    p_sort_direction: params.sortDirection ?? "desc",
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    throw new Error(
      error.message.includes("get_ops_sku_performance_summary")
        ? "SKU Performance is not set up yet. Run setup_sku_performance_mv.sql on Supabase."
        : error.message,
    );
  }

  const payload = (data ?? {}) as RpcSummaryPayload;
  const rows = (payload.data ?? []).map((row) => ({
    ...row,
    approved_quantity: Number(row.approved_quantity) || 0,
    dispatched_quantity: Number(row.dispatched_quantity) || 0,
    delivered_quantity: Number(row.delivered_quantity) || 0,
    dispatch_to_delivery_pct:
      row.dispatch_to_delivery_pct == null
        ? null
        : Number(row.dispatch_to_delivery_pct),
    weighted_average:
      row.weighted_average == null ? null : Number(row.weighted_average),
    available_inventory: null as number | null,
    seller_count: Number(row.seller_count) || 0,
  }));

  let inventoryWarning: string | null = null;
  try {
    const inventoryMap = await fetchInventoryBySkus(
      rows.map((r) => r.sku),
      rpcFilters.p_country,
    );
    for (const row of rows) {
      const key = row.sku.toUpperCase().trim();
      row.available_inventory = inventoryMap.has(key)
        ? Math.max(0, inventoryMap.get(key)!)
        : 0;
    }
  } catch (err) {
    inventoryWarning =
      err instanceof Error
        ? err.message
        : "Inventory data temporarily unavailable";
    for (const row of rows) {
      row.available_inventory = null;
    }
  }

  const inventorySync = await getLastSync("inventory");
  const totalRecords = Number(payload.total_records) || 0;

  return {
    data: rows,
    totalRecords,
    totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    mvRefreshedAt: payload.mv_refreshed_at ?? null,
    inventoryRefreshedAt: inventorySync?.synced_at ?? null,
    inventoryWarning,
  };
}

export async function getSkuPerformanceSellers(params: {
  sku: string;
  filters: SkuPerformanceFilters;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: SkuSellerRow[];
  totalRecords: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const rpcFilters = toSellerRpcFilters(params.filters);

  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_sku_performance_sellers", {
    p_sku: params.sku,
    p_country: rpcFilters.p_country,
    p_bifurcation: rpcFilters.p_bifurcation,
    p_from_date: rpcFilters.p_from_date,
    p_to_date: rpcFilters.p_to_date,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as RpcSellersPayload;
  const rows = (payload.data ?? []).map((row) => ({
    ...row,
    store_id: Number(row.store_id) || 0,
    user_id: row.user_id == null ? null : Number(row.user_id),
    approved_quantity: Number(row.approved_quantity) || 0,
    dispatched_quantity: Number(row.dispatched_quantity) || 0,
    delivered_quantity: Number(row.delivered_quantity) || 0,
    dispatch_to_delivery_pct:
      row.dispatch_to_delivery_pct == null
        ? null
        : Number(row.dispatch_to_delivery_pct),
    weighted_average:
      row.weighted_average == null ? null : Number(row.weighted_average),
  }));

  const totalRecords = Number(payload.total_records) || 0;

  return {
    data: rows,
    totalRecords,
    totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
  };
}

export function formatPstTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Los_Angeles",
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
