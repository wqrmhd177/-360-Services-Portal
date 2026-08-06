import { normalizeCountryFilterParam } from "@/lib/country-normalization";
import { formatStoreDisplayName } from "@/lib/operations/storeDisplayName";
import { getLastSync, getOpsDb } from "@/lib/operations/opsDb";
import { normalizeOptionalFilter } from "@/lib/orders/filteredItems";

export type NdRemarkStatus = "Open" | "Pending" | "Closed";

export type NdReportFilters = {
  country?: string | null;
  bifurcation?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
};

export type NdSkuSummaryRow = {
  country: string;
  bifurcation: string;
  sku: string;
  title: string;
  nd_orders: number;
  nd_quantity: number;
  store_count: number;
  fulfilment_route: string | null;
  suggestion_count: number;
};

export type NdReportTotals = {
  nd_skus: number;
  nd_orders: number;
  nd_quantity: number;
  affected_stores: number;
};

export type NdStoreDetailRow = {
  store_id: number;
  user_id: number | null;
  store_name: string | null;
  nd_orders: number;
  nd_quantity: number;
  po_qty: number | null;
  in_transit_inventory: number | null;
  ops_remarks: string | null;
  growth_feedback: string | null;
  status: NdRemarkStatus;
  remark_updated_by: string | null;
  remark_updated_at: string | null;
};

export type NdStuckOrderRow = {
  order_id: number;
  order_number: string | null;
  approved_date: string | null;
  sku: string;
  nd_quantity: number;
  store_id: number;
  store_name: string | null;
};

export type NdMovementSuggestion = {
  source_sku: string;
  surplus_qty: number;
  suggested_qty: number;
};

export type NdRemarkLog = {
  id: number;
  field_name: "ops_remarks" | "growth_feedback" | "status";
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
};

export type InventoryFulfilmentRoute = {
  sku: string;
  fulfilment_route: string;
  updated_by: string;
  updated_at: string;
};

export type FulfilmentRouteLog = {
  id: number;
  sku: string;
  old_route: string | null;
  new_route: string;
  changed_by: string;
  changed_at: string;
};

type RpcSummaryPayload = {
  data?: NdSkuSummaryRow[];
  totals?: NdReportTotals;
  total_records?: number;
  mv_refreshed_at?: string | null;
};

function toRpcFilters(filters: NdReportFilters) {
  return {
    p_country: normalizeCountryFilterParam(filters.country),
    p_bifurcation: normalizeOptionalFilter(filters.bifurcation),
    p_from_date: normalizeOptionalFilter(filters.fromDate),
    p_to_date: normalizeOptionalFilter(filters.toDate),
    p_search: normalizeOptionalFilter(filters.search),
  };
}

function mapSummaryRow(row: NdSkuSummaryRow): NdSkuSummaryRow {
  return {
    country: String(row.country ?? ""),
    bifurcation: String(row.bifurcation ?? ""),
    sku: String(row.sku ?? ""),
    title: String(row.title ?? ""),
    nd_orders: Number(row.nd_orders) || 0,
    nd_quantity: Number(row.nd_quantity) || 0,
    store_count: Number(row.store_count) || 0,
    fulfilment_route: row.fulfilment_route ?? null,
    suggestion_count: Number(row.suggestion_count) || 0,
  };
}

function mapRemarkStatus(value: unknown): NdRemarkStatus {
  if (value === "Pending" || value === "Closed") return value;
  return "Open";
}

export async function getNdReportSummary(params: {
  filters: NdReportFilters;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<{
  data: NdSkuSummaryRow[];
  totals: NdReportTotals;
  totalRecords: number;
  totalPages: number;
  mvRefreshedAt: string | null;
  inventoryRefreshedAt: string | null;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const rpcFilters = toRpcFilters(params.filters);

  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_nd_summary", {
    ...rpcFilters,
    p_sort_by: params.sortBy ?? "nd_quantity",
    p_sort_dir: params.sortDir ?? "desc",
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    const msg = error.message;
    throw new Error(
      msg.includes("get_ops_nd_summary") || msg.includes("does not exist")
        ? "ND Report is not set up yet. Run setup_nd_report.sql on Supabase."
        : msg.includes("remarks_text")
          ? "ND Report RPC is out of date. Re-run patch_nd_report_enhancements.sql (step 13) or patch_nd_report_order_details.sql (step 16) on Supabase."
          : msg,
    );
  }

  const payload = (data ?? {}) as RpcSummaryPayload;
  const rows = (payload.data ?? []).map((row) => mapSummaryRow(row as NdSkuSummaryRow));
  const totals = payload.totals ?? {
    nd_skus: 0,
    nd_orders: 0,
    nd_quantity: 0,
    affected_stores: 0,
  };
  const totalRecords = Number(payload.total_records) || 0;

  const inventorySync = await getLastSync("inventory");

  return {
    data: rows,
    totals: {
      nd_skus: Number(totals.nd_skus) || 0,
      nd_orders: Number(totals.nd_orders) || 0,
      nd_quantity: Number(totals.nd_quantity) || 0,
      affected_stores: Number(totals.affected_stores) || 0,
    },
    totalRecords,
    totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
    mvRefreshedAt: payload.mv_refreshed_at ?? null,
    inventoryRefreshedAt: inventorySync?.synced_at ?? null,
  };
}

export async function getNdSkuDetails(params: {
  sku: string;
  country: string;
  bifurcation: string;
  fromDate?: string | null;
  toDate?: string | null;
}): Promise<{
  rows: NdStoreDetailRow[];
  stuckOrders: NdStuckOrderRow[];
  movementSuggestions: NdMovementSuggestion[];
}> {
  const supabase = getOpsDb();
  const rpcFilters = {
    p_country: normalizeCountryFilterParam(params.country) ?? params.country,
    p_bifurcation: normalizeOptionalFilter(params.bifurcation) ?? "",
    p_sku: params.sku,
    p_from_date: normalizeOptionalFilter(params.fromDate),
    p_to_date: normalizeOptionalFilter(params.toDate),
  };

  const [detailsRes, suggestionsRes, stuckRes] = await Promise.all([
    supabase.rpc("get_ops_nd_sku_details", rpcFilters),
    supabase.rpc("get_ops_nd_movement_suggestions", {
      p_country: rpcFilters.p_country,
      p_bifurcation: rpcFilters.p_bifurcation,
      p_sku: rpcFilters.p_sku,
    }),
    supabase.rpc("get_ops_nd_stuck_orders", rpcFilters),
  ]);

  if (detailsRes.error) {
    throw new Error(detailsRes.error.message);
  }
  if (suggestionsRes.error) {
    throw new Error(suggestionsRes.error.message);
  }
  if (stuckRes.error) {
    throw new Error(stuckRes.error.message);
  }

  const rows = (Array.isArray(detailsRes.data) ? detailsRes.data : []).map(
    (row: Record<string, unknown>) => ({
      store_id: Number(row.store_id) || 0,
      user_id: row.user_id == null ? null : Number(row.user_id),
      store_name:
        row.store_name == null
          ? null
          : formatStoreDisplayName(String(row.store_name)),
      nd_orders: Number(row.nd_orders) || 0,
      nd_quantity: Number(row.nd_quantity) || 0,
      po_qty: row.po_qty == null ? null : Number(row.po_qty),
      in_transit_inventory:
        row.in_transit_inventory == null ? null : Number(row.in_transit_inventory),
      ops_remarks: row.ops_remarks == null ? null : String(row.ops_remarks),
      growth_feedback:
        row.growth_feedback == null ? null : String(row.growth_feedback),
      status: mapRemarkStatus(row.status),
      remark_updated_by:
        row.remark_updated_by == null ? null : String(row.remark_updated_by),
      remark_updated_at:
        row.remark_updated_at == null ? null : String(row.remark_updated_at),
    }),
  );

  const movementSuggestions = (
    Array.isArray(suggestionsRes.data) ? suggestionsRes.data : []
  ).map((row: Record<string, unknown>) => ({
    source_sku: String(row.source_sku ?? ""),
    surplus_qty: Number(row.surplus_qty) || 0,
    suggested_qty: Number(row.suggested_qty) || 0,
  }));

  const stuckOrders = (Array.isArray(stuckRes.data) ? stuckRes.data : []).map(
    (row: Record<string, unknown>) => ({
      order_id: Number(row.order_id) || 0,
      order_number: row.order_number == null ? null : String(row.order_number),
      approved_date: row.approved_date == null ? null : String(row.approved_date),
      sku: String(row.sku ?? params.sku),
      nd_quantity: Number(row.nd_quantity) || 0,
      store_id: Number(row.store_id) || 0,
      store_name:
        row.store_name == null
          ? null
          : formatStoreDisplayName(String(row.store_name)),
    }),
  );

  return { rows, stuckOrders, movementSuggestions };
}

export async function upsertNdStoreRemark(params: {
  country: string;
  bifurcation: string;
  sku: string;
  storeId: number;
  opsRemarks: string | null;
  growthFeedback: string | null;
  status: NdRemarkStatus;
  updatedBy: string;
}): Promise<{
  country: string;
  bifurcation: string;
  sku: string;
  store_id: number;
  ops_remarks: string | null;
  growth_feedback: string | null;
  status: NdRemarkStatus;
  updated_by: string;
  updated_at: string;
}> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("upsert_ops_nd_store_remark", {
    p_country: normalizeCountryFilterParam(params.country) ?? params.country,
    p_bifurcation: normalizeOptionalFilter(params.bifurcation) ?? "",
    p_sku: params.sku,
    p_store_id: params.storeId,
    p_ops_remarks: params.opsRemarks ?? "",
    p_growth_feedback: params.growthFeedback ?? "",
    p_status: params.status,
    p_updated_by: params.updatedBy,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    country: String(payload.country ?? ""),
    bifurcation: String(payload.bifurcation ?? ""),
    sku: String(payload.sku ?? ""),
    store_id: Number(payload.store_id) || 0,
    ops_remarks: payload.ops_remarks == null ? null : String(payload.ops_remarks),
    growth_feedback:
      payload.growth_feedback == null ? null : String(payload.growth_feedback),
    status: mapRemarkStatus(payload.status),
    updated_by: String(payload.updated_by ?? ""),
    updated_at: String(payload.updated_at ?? ""),
  };
}

export async function getNdRemarkLogs(params: {
  country: string;
  bifurcation: string;
  sku: string;
  storeId: number;
}): Promise<NdRemarkLog[]> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_nd_remark_logs", {
    p_country: normalizeCountryFilterParam(params.country) ?? params.country,
    p_bifurcation: normalizeOptionalFilter(params.bifurcation) ?? "",
    p_sku: params.sku,
    p_store_id: params.storeId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    id: Number(row.id) || 0,
    field_name: String(row.field_name ?? "ops_remarks") as NdRemarkLog["field_name"],
    old_value: row.old_value == null ? null : String(row.old_value),
    new_value: row.new_value == null ? null : String(row.new_value),
    changed_by: String(row.changed_by ?? ""),
    changed_at: String(row.changed_at ?? ""),
  }));
}

export async function getNdFilterOptions(): Promise<{
  countries: string[];
  bifurcations: string[];
}> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_nd_filter_options");
  if (error) {
    throw new Error(error.message);
  }
  const payload = (data ?? {}) as { countries?: string[]; bifurcations?: string[] };
  return {
    countries: payload.countries ?? [],
    bifurcations: payload.bifurcations ?? [],
  };
}

export async function getInventoryFulfilmentRoutes(
  skus?: string[],
): Promise<InventoryFulfilmentRoute[]> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_inventory_fulfilment_routes", {
    p_skus: skus?.length ? skus : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    sku: String(row.sku ?? ""),
    fulfilment_route: String(row.fulfilment_route ?? ""),
    updated_by: String(row.updated_by ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));
}

export async function getInventoryFulfilmentRouteOptions(): Promise<string[]> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_inventory_fulfilment_route_options");

  if (error) {
    return [];
  }

  return Array.isArray(data) ? data.map(String) : [];
}

export async function upsertInventoryFulfilmentRoute(params: {
  sku: string;
  fulfilmentRoute: string;
  updatedBy: string;
}): Promise<InventoryFulfilmentRoute> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("upsert_ops_inventory_fulfilment_route", {
    p_sku: params.sku,
    p_route: params.fulfilmentRoute,
    p_updated_by: params.updatedBy,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    sku: String(payload.sku ?? ""),
    fulfilment_route: String(payload.fulfilment_route ?? ""),
    updated_by: String(payload.updated_by ?? ""),
    updated_at: String(payload.updated_at ?? ""),
  };
}

export async function bulkUpsertInventoryFulfilmentRoutes(params: {
  routes: Array<{ sku: string; fulfilment_route: string }>;
  updatedBy: string;
}): Promise<{ updated: number; skipped: number; errors: Array<{ sku: string; error: string }> }> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("bulk_upsert_ops_inventory_fulfilment_routes", {
    p_routes: params.routes,
    p_updated_by: params.updatedBy,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    updated: Number(payload.updated) || 0,
    skipped: Number(payload.skipped) || 0,
    errors: Array.isArray(payload.errors)
      ? payload.errors.map((e: Record<string, unknown>) => ({
          sku: String(e.sku ?? ""),
          error: String(e.error ?? "Unknown error"),
        }))
      : [],
  };
}

export async function getInventoryFulfilmentRouteLogs(
  sku: string,
): Promise<FulfilmentRouteLog[]> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_inventory_fulfilment_route_logs", {
    p_sku: sku,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    id: Number(row.id) || 0,
    sku: String(row.sku ?? ""),
    old_route: row.old_route == null ? null : String(row.old_route),
    new_route: String(row.new_route ?? ""),
    changed_by: String(row.changed_by ?? ""),
    changed_at: String(row.changed_at ?? ""),
  }));
}

export { formatPortalTimestamp, formatPortalTimestamp as formatPstTimestamp } from "@/lib/portalTimezone";
