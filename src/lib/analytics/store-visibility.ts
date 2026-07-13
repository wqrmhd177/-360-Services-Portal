import {
  groupByOrder,
  orderRepresentativeLine,
  orderStatusFromLines,
} from "@/lib/analytics/orders";
import type { OrderLineItem } from "@/lib/types/order";

export type ProductOrderRow = {
  product: string;
  orders: number;
};

export type ReasonCountRow = {
  reason: string;
  orders: number;
};

export type ProductDeliveryRow = {
  product: string;
  orders: number;
  delivered: number;
  deliveryRatio: number;
};

export type StoreVisibilityTables = {
  productOrders: ProductOrderRow[];
  confirmationReasons: ReasonCountRow[];
  productDeliveryRatios: ProductDeliveryRow[];
  undeliveredReasons: ReasonCountRow[];
};

function normalizeTag(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No tag";
}

function normalizeTitle(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "Unknown";
}

function sortByOrdersDesc<T extends { orders: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.orders - a.orders || 0);
}

/** Products running in the store with order counts (unique Metabase ids per product). */
export function computeStoreProductOrders(
  items: OrderLineItem[],
): ProductOrderRow[] {
  const byOrder = groupByOrder(items);
  const productOrders = new Map<string, Set<number>>();

  for (const [, lines] of byOrder) {
    const titles = new Set(lines.map((line) => normalizeTitle(line.title)));
    for (const title of titles) {
      const ids = productOrders.get(title) ?? new Set<number>();
      ids.add(lines[0]!.metabaseId);
      productOrders.set(title, ids);
    }
  }

  return sortByOrdersDesc(
    [...productOrders.entries()].map(([product, ids]) => ({
      product,
      orders: ids.size,
    })),
  );
}

function computeStatusTagBreakdown(
  items: OrderLineItem[],
  statuses: readonly string[],
): ReasonCountRow[] {
  const statusSet = new Set(statuses);
  const byOrder = groupByOrder(items);
  const tagCounts = new Map<string, Set<number>>();

  for (const [, lines] of byOrder) {
    const status = orderStatusFromLines(lines);
    if (!statusSet.has(status)) continue;

    const line = orderRepresentativeLine(lines);
    if (!line) continue;

    const tag = normalizeTag(line.tag);
    const ids = tagCounts.get(tag) ?? new Set<number>();
    ids.add(line.metabaseId);
    tagCounts.set(tag, ids);
  }

  return sortByOrdersDesc(
    [...tagCounts.entries()].map(([reason, ids]) => ({
      reason,
      orders: ids.size,
    })),
  );
}

/** Confirmation Pending orders grouped by tag (reason). */
export function computeConfirmationReasonBreakdown(
  items: OrderLineItem[],
): ReasonCountRow[] {
  return computeStatusTagBreakdown(items, ["Confirmation Pending"]);
}

/** Undelivered orders grouped by tag (reason). */
export function computeUndeliveredReasonBreakdown(
  items: OrderLineItem[],
): ReasonCountRow[] {
  return computeStatusTagBreakdown(items, ["Undelivered"]);
}

/** Product-wise delivery ratio (% of orders delivered). */
export function computeStoreProductDeliveryRatios(
  items: OrderLineItem[],
): ProductDeliveryRow[] {
  const byOrder = groupByOrder(items);
  const productOrders = new Map<string, Set<number>>();
  const productDelivered = new Map<string, Set<number>>();

  for (const [, lines] of byOrder) {
    const status = orderStatusFromLines(lines);
    const isDelivered = status === "Delivered";
    const titles = new Set(lines.map((line) => normalizeTitle(line.title)));
    const orderId = lines[0]!.metabaseId;

    for (const title of titles) {
      const orders = productOrders.get(title) ?? new Set<number>();
      orders.add(orderId);
      productOrders.set(title, orders);

      if (isDelivered) {
        const delivered = productDelivered.get(title) ?? new Set<number>();
        delivered.add(orderId);
        productDelivered.set(title, delivered);
      }
    }
  }

  return sortByOrdersDesc(
    [...productOrders.entries()].map(([product, orderIds]) => {
      const orders = orderIds.size;
      const delivered = productDelivered.get(product)?.size ?? 0;
      return {
        product,
        orders,
        delivered,
        deliveryRatio: orders > 0 ? delivered / orders : 0,
      };
    }),
  );
}

export function computeStoreVisibilityTables(
  items: OrderLineItem[],
): StoreVisibilityTables {
  return {
    productOrders: computeStoreProductOrders(items),
    confirmationReasons: computeConfirmationReasonBreakdown(items),
    productDeliveryRatios: computeStoreProductDeliveryRatios(items),
    undeliveredReasons: computeUndeliveredReasonBreakdown(items),
  };
}
