import type { StoreVisibilityTables } from "@/lib/analytics/store-visibility";
import { getOpsDb } from "@/lib/operations/opsDb";
import {
  type OrdersFilterParams,
  toRpcFilterParams,
} from "@/lib/orders/filteredItems";

type StoreVisibilityRpcPayload = {
  productOrders?: Array<{ product: string; orders: number }>;
  confirmationReasons?: Array<{ reason: string; orders: number }>;
  productDeliveryRatios?: Array<{
    product: string;
    orders: number;
    delivered: number;
    deliveryRatio: number;
  }>;
  undeliveredReasons?: Array<{ reason: string; orders: number }>;
};

export function mapStoreVisibilityTables(
  payload: StoreVisibilityRpcPayload | null,
): StoreVisibilityTables {
  const empty: StoreVisibilityTables = {
    productOrders: [],
    confirmationReasons: [],
    productDeliveryRatios: [],
    undeliveredReasons: [],
  };
  if (!payload || typeof payload !== "object") return empty;

  return {
    productOrders: (payload.productOrders ?? []).map((row) => ({
      product: row.product,
      orders: Number(row.orders ?? 0),
    })),
    confirmationReasons: (payload.confirmationReasons ?? []).map((row) => ({
      reason: row.reason,
      orders: Number(row.orders ?? 0),
    })),
    productDeliveryRatios: (payload.productDeliveryRatios ?? []).map((row) => ({
      product: row.product,
      orders: Number(row.orders ?? 0),
      delivered: Number(row.delivered ?? 0),
      deliveryRatio: Number(row.deliveryRatio ?? 0),
    })),
    undeliveredReasons: (payload.undeliveredReasons ?? []).map((row) => ({
      reason: row.reason,
      orders: Number(row.orders ?? 0),
    })),
  };
}

export async function fetchStoreVisibilityTables(
  filters: OrdersFilterParams,
): Promise<StoreVisibilityTables> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc(
    "get_ops_store_visibility_tables",
    toRpcFilterParams(filters),
  );

  if (error) {
    throw new Error(`get_ops_store_visibility_tables failed: ${error.message}`);
  }

  return mapStoreVisibilityTables(
    (data ?? null) as StoreVisibilityRpcPayload | null,
  );
}
