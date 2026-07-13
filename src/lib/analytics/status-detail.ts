import {
  groupByOrder,
  orderStatusFromLines,
  orderRepresentativeLine,
  type OrderGroupKey,
  type OrderGroupMap,
} from "@/lib/analytics/orders";
import { STATUS_DISPATCH_EXCLUDED } from "@/lib/constants";
import type { OrderLineItem } from "@/lib/types/order";

export type StatusProductRow = {
  product: string;
  orders: number;
  pct: number;
  units: number;
  dispatchToDeliver: number | null;
  receiveToDeliver: number | null;
  orderNumbers: string[];
};

export type StatusCountryGroup = {
  country: string;
  orders: number;
  pct: number;
  products: StatusProductRow[];
};

export type DeliveredStatusDetail = {
  kind: "delivered";
  totalDeliveredOrders: number;
  totalUnits: number;
  countries: StatusCountryGroup[];
};

export type StandardStatusProductRow = {
  product: string;
  orders: number;
  pct: number;
  orderNumbers: string[];
};

export type StandardStatusTagGroup = {
  tag: string;
  orders: number;
  pct: number;
  products: StandardStatusProductRow[];
};

export type StandardStatusCountryGroup = {
  country: string;
  orders: number;
  pct: number;
  tags: StandardStatusTagGroup[];
};

export type StandardStatusDetail = {
  kind: "standard";
  status: string;
  totalOrders: number;
  countries: StandardStatusCountryGroup[];
};

export type StatusDetailResponse = DeliveredStatusDetail | StandardStatusDetail;

function normalizeCountry(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "Unknown";
}

function normalizeProduct(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No title";
}

function normalizeTag(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No tag";
}

function bucketKey(country: string, product: string): string {
  return `${country}\0${product}`;
}

function parseBucketKey(key: string): { country: string; product: string } {
  const [country, product] = key.split("\0");
  return { country: country ?? "Unknown", product: product ?? "No title" };
}

function orderNumbersFromKeys(
  byOrder: OrderGroupMap,
  keys: Iterable<OrderGroupKey>,
): string[] {
  const numbers = new Set<string>();
  for (const key of keys) {
    const num = byOrder.get(key)?.[0]?.orderNumber?.trim();
    if (num) numbers.add(num);
  }
  return [...numbers].sort((a, b) => a.localeCompare(b));
}

/**
 * Sort key for Receive → Deliver (higher first).
 * Tie-break: more delivered orders, then product name.
 */
export function compareByReceiveToDeliver(
  a: StatusProductRow,
  b: StatusProductRow,
): number {
  const aRate = a.receiveToDeliver;
  const bRate = b.receiveToDeliver;
  if (aRate === null && bRate === null) {
    return compareByOrdersThenName(a, b);
  }
  if (aRate === null) return 1;
  if (bRate === null) return -1;
  const rateCmp = bRate - aRate;
  if (rateCmp !== 0) return rateCmp;
  return compareByOrdersThenName(a, b);
}

function compareByOrdersThenName(
  a: StatusProductRow,
  b: StatusProductRow,
): number {
  const ordersCmp = b.orders - a.orders;
  if (ordersCmp !== 0) return ordersCmp;
  return a.product.localeCompare(b.product);
}

function sortCountryProducts(
  countries: StatusCountryGroup[],
): StatusCountryGroup[] {
  return countries.map((group) => ({
    ...group,
    products: [...group.products].sort(compareByReceiveToDeliver),
  }));
}

/** Ensures delivered detail rows are ordered by Receive → Deliver (desc). */
export function sortDeliveredStatusDetail(
  detail: DeliveredStatusDetail,
): DeliveredStatusDetail {
  return {
    ...detail,
    countries: sortCountryProducts(detail.countries),
  };
}

type BucketAgg = {
  allOrders: Set<OrderGroupKey>;
  dispatchEligible: Set<OrderGroupKey>;
  delivered: Set<OrderGroupKey>;
  units: number;
};

/**
 * Delivered breakdown by country × product (title).
 * Order-level status from lines[0] applies to the whole order; each distinct
 * (country, title) on line items gets its own row (multi-product orders appear in multiple rows).
 */
export function computeDeliveredStatusDetail(
  items: OrderLineItem[],
): DeliveredStatusDetail {
  const byOrder = groupByOrder(items);
  const buckets = new Map<string, BucketAgg>();

  function getBucket(key: string): BucketAgg {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        allOrders: new Set(),
        dispatchEligible: new Set(),
        delivered: new Set(),
        units: 0,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  for (const [orderKey, lines] of byOrder) {
    const status = orderStatusFromLines(lines);
    const isDelivered = status === "Delivered";
    const dispatchEligible = !STATUS_DISPATCH_EXCLUDED.has(status);

    const keysOnOrder = new Set<string>();
    for (const line of lines) {
      const key = bucketKey(
        normalizeCountry(line.country),
        normalizeProduct(line.title),
      );
      keysOnOrder.add(key);
    }

    for (const key of keysOnOrder) {
      const bucket = getBucket(key);
      bucket.allOrders.add(orderKey);
      if (dispatchEligible) bucket.dispatchEligible.add(orderKey);
      if (isDelivered) bucket.delivered.add(orderKey);
    }

    if (isDelivered) {
      for (const line of lines) {
        const key = bucketKey(
          normalizeCountry(line.country),
          normalizeProduct(line.title),
        );
        getBucket(key).units += line.quantity;
      }
    }
  }

  const rowEntries: {
    country: string;
    product: string;
    orders: number;
    units: number;
    dispatchToDeliver: number | null;
    receiveToDeliver: number | null;
    orderNumbers: string[];
  }[] = [];

  let totalDeliveredOrders = 0;
  let totalUnits = 0;

  for (const [key, bucket] of buckets) {
    const deliveredCount = bucket.delivered.size;
    if (deliveredCount === 0) continue;

    const { country, product } = parseBucketKey(key);
    const dispatchDenom = bucket.dispatchEligible.size;
    const allCount = bucket.allOrders.size;

    rowEntries.push({
      country,
      product,
      orders: deliveredCount,
      units: bucket.units,
      dispatchToDeliver:
        dispatchDenom > 0 ? deliveredCount / dispatchDenom : null,
      receiveToDeliver: allCount > 0 ? deliveredCount / allCount : null,
      orderNumbers: orderNumbersFromKeys(byOrder, bucket.delivered),
    });

    totalUnits += bucket.units;
  }

  const deliveredOrderKeys = new Set<OrderGroupKey>();
  for (const [orderKey, lines] of byOrder) {
    if (orderStatusFromLines(lines) === "Delivered") {
      deliveredOrderKeys.add(orderKey);
    }
  }
  totalDeliveredOrders = deliveredOrderKeys.size;

  const countryDeliveredOrders = new Map<string, Set<OrderGroupKey>>();
  for (const [orderKey, lines] of byOrder) {
    if (orderStatusFromLines(lines) !== "Delivered") continue;
    const countriesOnOrder = new Set<string>();
    for (const line of lines) {
      countriesOnOrder.add(normalizeCountry(line.country));
    }
    for (const country of countriesOnOrder) {
      if (!countryDeliveredOrders.has(country)) {
        countryDeliveredOrders.set(country, new Set());
      }
      countryDeliveredOrders.get(country)!.add(orderKey);
    }
  }

  const deliveredPct = (orders: number) =>
    totalDeliveredOrders > 0 ? orders / totalDeliveredOrders : 0;

  const byCountry = new Map<string, StatusProductRow[]>();
  for (const row of rowEntries) {
    const list = byCountry.get(row.country) ?? [];
    list.push({
      product: row.product,
      orders: row.orders,
      pct: deliveredPct(row.orders),
      units: row.units,
      dispatchToDeliver: row.dispatchToDeliver,
      receiveToDeliver: row.receiveToDeliver,
      orderNumbers: row.orderNumbers,
    });
    byCountry.set(row.country, list);
  }

  const countries: StatusCountryGroup[] = [...byCountry.entries()]
    .map(([country, products]) => {
      const countryOrderCount = countryDeliveredOrders.get(country)?.size ?? 0;
      return {
        country,
        orders: countryOrderCount,
        pct: deliveredPct(countryOrderCount),
        products,
      };
    })
    .sort((a, b) => {
      const o = b.orders - a.orders;
      return o !== 0 ? o : a.country.localeCompare(b.country);
    });

  return sortDeliveredStatusDetail({
    kind: "delivered",
    totalDeliveredOrders,
    totalUnits,
    countries,
  });
}

/**
 * Nested country → tag → product breakdown for a single status.
 * One order maps to one path via lines[0]; all % use status order total.
 */
export function computeStandardStatusDetail(
  statusName: string,
  items: OrderLineItem[],
): StandardStatusDetail {
  const byOrder = groupByOrder(items);
  const tree = new Map<
    string,
    Map<string, Map<string, Set<OrderGroupKey>>>
  >();

  for (const [orderKey, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    if (!line) continue;
    const status = orderStatusFromLines(lines);
    if (status !== statusName) continue;

    const country = normalizeCountry(line.country);
    const tag = normalizeTag(line.tag);
    const product = normalizeProduct(line.title);

    if (!tree.has(country)) tree.set(country, new Map());
    const tagMap = tree.get(country)!;
    if (!tagMap.has(tag)) tagMap.set(tag, new Map());
    const productMap = tagMap.get(tag)!;
    if (!productMap.has(product)) productMap.set(product, new Set());
    productMap.get(product)!.add(orderKey);
  }

  const countryOrders = new Map<string, Set<OrderGroupKey>>();
  for (const [orderKey, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    if (!line) continue;
    if (orderStatusFromLines(lines) !== statusName) continue;
    const country = normalizeCountry(line.country);
    if (!countryOrders.has(country)) countryOrders.set(country, new Set());
    countryOrders.get(country)!.add(orderKey);
  }

  const totalOrders = [...countryOrders.values()].reduce(
    (sum, set) => sum + set.size,
    0,
  );

  const pct = (orders: number) => (totalOrders > 0 ? orders / totalOrders : 0);

  const countries: StandardStatusCountryGroup[] = [...tree.entries()]
    .map(([country, tagMap]) => {
      const tags: StandardStatusTagGroup[] = [...tagMap.entries()]
        .map(([tag, productMap]) => {
          const tagOrderKeys = new Set<OrderGroupKey>();
          for (const orderKeys of productMap.values()) {
            for (const key of orderKeys) tagOrderKeys.add(key);
          }

          const products: StandardStatusProductRow[] = [...productMap.entries()]
            .map(([product, orderKeys]) => ({
              product,
              orders: orderKeys.size,
              pct: pct(orderKeys.size),
              orderNumbers: orderNumbersFromKeys(byOrder, orderKeys),
            }))
            .sort((a, b) => {
              const o = b.orders - a.orders;
              return o !== 0 ? o : a.product.localeCompare(b.product);
            });

          return {
            tag,
            orders: tagOrderKeys.size,
            pct: pct(tagOrderKeys.size),
            products,
          };
        })
        .sort((a, b) => {
          const o = b.orders - a.orders;
          return o !== 0 ? o : a.tag.localeCompare(b.tag);
        });

      const countryOrderCount = countryOrders.get(country)?.size ?? 0;

      return {
        country,
        orders: countryOrderCount,
        pct: pct(countryOrderCount),
        tags,
      };
    })
    .sort((a, b) => {
      const o = b.orders - a.orders;
      return o !== 0 ? o : a.country.localeCompare(b.country);
    });

  return {
    kind: "standard",
    status: statusName,
    totalOrders,
    countries,
  };
}

export function computeStatusDetail(
  statusName: string,
  items: OrderLineItem[],
): StatusDetailResponse {
  if (statusName === "Delivered") {
    return computeDeliveredStatusDetail(items);
  }
  return computeStandardStatusDetail(statusName, items);
}
