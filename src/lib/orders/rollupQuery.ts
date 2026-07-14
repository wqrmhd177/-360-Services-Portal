import { getOpsDb } from "@/lib/operations/opsDb";
import {
  type OrdersFilterParams,
  normalizeOptionalFilter,
} from "@/lib/orders/filteredItems";

export type OrdersRollupTable =
  | "ops_orders_status_rollup"
  | "ops_orders_delivery_partner_rollup"
  | "ops_orders_revenue_loss_rollup"
  | "ops_orders_sla_rollup";

const ROLLUP_ORDER_COLUMNS: Record<OrdersRollupTable, string[]> = {
  ops_orders_status_rollup: [
    "order_date_day",
    "country",
    "bifurcation",
    "store_id",
    "status",
  ],
  ops_orders_delivery_partner_rollup: [
    "order_date_day",
    "country",
    "bifurcation",
    "store_id",
    "delivery_partner",
    "status",
  ],
  ops_orders_revenue_loss_rollup: [
    "order_date_day",
    "country",
    "bifurcation",
    "store_id",
    "tag",
    "dispatch_label",
  ],
  ops_orders_sla_rollup: [
    "order_date_day",
    "country",
    "bifurcation",
    "store_id",
  ],
};

function applyRollupFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: OrdersFilterParams,
) {
  const country = normalizeOptionalFilter(filters.country);
  const bifurcation = normalizeOptionalFilter(filters.bifurcation);
  const fromDate = normalizeOptionalFilter(filters.fromDate);
  const toDate = normalizeOptionalFilter(filters.toDate);

  if (fromDate) query = query.gte("order_date_day", fromDate);
  if (toDate) query = query.lte("order_date_day", toDate);
  if (filters.storeId != null) query = query.eq("store_id", filters.storeId);

  if (country) {
    query = query.eq("country", country);
  } else {
    query = query.neq("country", "Unknown").neq("country", "");
  }

  if (bifurcation) {
    query = query.eq("bifurcation", bifurcation);
  } else {
    query = query.neq("bifurcation", "");
  }

  return query;
}

/** Paginated fetch from an ops_orders_* materialized view with standard facet filters. */
export async function fetchOrdersRollupRows<T>(
  table: OrdersRollupTable,
  filters: OrdersFilterParams,
  select: string,
): Promise<T[]> {
  const supabase = getOpsDb();
  const pageSize = 1000;
  let offset = 0;
  const allRows: T[] = [];
  const orderColumns = ROLLUP_ORDER_COLUMNS[table];

  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + pageSize - 1);

    for (const column of orderColumns) {
      query = query.order(column, { ascending: true });
    }

    query = applyRollupFilters(query, filters);

    const { data, error } = await query;
    if (error) {
      throw new Error(`${table} fetch failed: ${error.message}`);
    }

    const rows = (data ?? []) as T[];
    if (!rows.length) break;

    allRows.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}
