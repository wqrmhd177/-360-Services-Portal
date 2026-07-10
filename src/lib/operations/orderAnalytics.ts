import type { OrderRow } from "@/lib/operations/orders";

function differenceInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

// ── Status KPI groups (ported from Ops Portal) ────────────────────────────────

export type OperationsStatusGroupId =
  | "confirmationPending"
  | "approved"
  | "dispatching"
  | "shipped"
  | "undelivered"
  | "preDispatchCancelled"
  | "return";

export interface OperationsStatusKpiGroup {
  id: OperationsStatusGroupId;
  title: string;
  statuses: readonly string[];
}

export const OPERATIONS_STATUS_KPI_GROUPS: readonly OperationsStatusKpiGroup[] = [
  { id: "confirmationPending", title: "Orders in Confirmation",           statuses: ["Confirmation Pending"] },
  { id: "approved",            title: "Orders in Approved",               statuses: ["Approved"] },
  { id: "dispatching",         title: "Orders in Dispatching in Process", statuses: ["Dispatching in Process"] },
  { id: "shipped",             title: "Orders in Shipped",                statuses: ["Shipped"] },
  { id: "undelivered",         title: "Orders in Undelivered",            statuses: ["Undelivered"] },
  { id: "preDispatchCancelled",title: "Pre Dispatch Cancelled",           statuses: ["Cancelled", "Canceled"] },
  { id: "return",              title: "Orders in Return",                 statuses: ["Return in Transit", "Return"] },
] as const;

// ── Revenue loss tag groups ───────────────────────────────────────────────────

const REVENUE_LOSS_TAG_GROUPS: Array<{ heading: string; tagPatterns: readonly string[] }> = [
  {
    heading: "Uncontactable Cancelled",
    tagPatterns: [
      "uncontactable (no response)", "uncontactable (no reponse)",
      "customer not reachable/no response", "customer not reachable/no reponse",
      "cutomer not reachable/no reponse",
      "customer stopped responding mags/calls", "customer stopped responding msgs/ calls",
      "cst hang up the call", "cst hang-up the call",
    ],
  },
  {
    heading: "Connected Cancelled",
    tagPatterns: [
      "customer cancelled the order", "cancelled by customer", "change of mind", "chnage of mind",
      "did not order", "does not want to give reason", "long reschedule", "not available/travelling",
      "no cash", "package discrepancy", "open package request",
      "order form other store/cheaper/warranty issue", "price issue",
    ],
  },
  {
    heading: "Seller issue",
    tagPatterns: [
      "invalid order", "invalid number", "duplicate order", "test/fake order",
      "on internal team request", "on sellers request", "wrong number", "product not available",
    ],
  },
  {
    heading: "Ops Issue",
    tagPatterns: ["item lost", "no service area"],
  },
];

function normalizeTagKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const TAG_TO_GROUP = new Map<string, string>();
for (const group of REVENUE_LOSS_TAG_GROUPS) {
  for (const pattern of group.tagPatterns) {
    TAG_TO_GROUP.set(normalizeTagKey(pattern), group.heading);
  }
}

function getRevenueLossGroup(tag: string): string | null {
  return TAG_TO_GROUP.get(normalizeTagKey(tag)) ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByOrderId(rows: OrderRow[]): Map<number, OrderRow[]> {
  const map = new Map<number, OrderRow[]>();
  for (const r of rows) {
    const list = map.get(r.orderId) ?? [];
    list.push(r);
    map.set(r.orderId, list);
  }
  return map;
}

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface OrderKPIs {
  totalOrders: number;
  grossRevenue: number;
  aov: number;
  unitsSold: number;
  deliveredRate: number;
  returnRate: number;
  currency: string;
}

export function computeKPIs(rows: OrderRow[]): OrderKPIs {
  const byOrder = groupByOrderId(rows);
  let revenue = 0;
  let delivered = 0;
  let returned = 0;
  const currency = rows.find((r) => r.currency)?.currency ?? "";

  for (const [, lines] of byOrder) {
    const status = lines[0].status;
    revenue += lines[0].totalPayable;
    if (status === "Delivered") delivered++;
    if (status === "Return" || status === "Returned" || status === "Return in Transit") returned++;
  }

  const unitsSold = rows.reduce((s, r) => s + r.quantity, 0);
  const total = byOrder.size;

  return {
    totalOrders: total,
    grossRevenue: revenue,
    aov: total ? revenue / total : 0,
    unitsSold,
    deliveredRate: total ? delivered / total : 0,
    returnRate: total ? returned / total : 0,
    currency,
  };
}

// ── Status counts ─────────────────────────────────────────────────────────────

export interface OperationsStatusCounts {
  byGroup: Record<OperationsStatusGroupId, number>;
}

export function computeOperationsStatusCounts(rows: OrderRow[]): OperationsStatusCounts {
  const byOrder = groupByOrderId(rows);
  const result = {} as Record<OperationsStatusGroupId, number>;
  for (const g of OPERATIONS_STATUS_KPI_GROUPS) result[g.id] = 0;

  for (const [, lines] of byOrder) {
    const status = lines[0].status?.trim() ?? "";
    for (const group of OPERATIONS_STATUS_KPI_GROUPS) {
      if ((group.statuses as readonly string[]).includes(status)) {
        result[group.id]++;
        break;
      }
    }
  }
  return { byGroup: result };
}

// ── SLA ───────────────────────────────────────────────────────────────────────

export interface CountrySlaRow {
  country: string;
  value: number | null;
  sampleCount: number;
}

export type FulfillmentSlaMetric = "confirm" | "ship" | "deliver" | "return" | "shipped48h";

export interface FulfillmentSLA {
  avgOrderToConfirmDays: number | null;
  avgOrderToShipDays: number | null;
  avgOrderToDeliverDays: number | null;
  avgOrderToReturnDays: number | null;
  shippedWithin48hPct: number;
  sampleSize: number;
  byCountry: Record<FulfillmentSlaMetric, CountrySlaRow[]>;
}

interface CountrySlaBucket {
  confirmDays: number[];
  shipDays: number[];
  deliverDays: number[];
  returnDays: number[];
  shipped48: number;
  shipCount: number;
}

export function computeFulfillmentSLA(rows: OrderRow[]): FulfillmentSLA {
  const byOrder = groupByOrderId(rows);
  const confirmDays: number[] = [];
  const shipDays: number[] = [];
  const deliverDays: number[] = [];
  const returnDays: number[] = [];
  const countryBuckets = new Map<string, CountrySlaBucket>();
  let shipped48 = 0;
  let shipCount = 0;

  function bucket(country: string): CountrySlaBucket {
    if (!countryBuckets.has(country)) {
      countryBuckets.set(country, { confirmDays: [], shipDays: [], deliverDays: [], returnDays: [], shipped48: 0, shipCount: 0 });
    }
    return countryBuckets.get(country)!;
  }

  for (const [, lines] of byOrder) {
    const o = lines[0];
    if (!o.orderDate) continue;
    const country = (o.country?.trim() || "Unknown");
    const b = bucket(country);

    if (o.approvedDate) {
      const d = differenceInDays(o.approvedDate, o.orderDate);
      confirmDays.push(d);
      b.confirmDays.push(d);
    }
    if (o.shipmentDate) {
      const d = differenceInDays(o.shipmentDate, o.orderDate);
      shipDays.push(d);
      shipCount++;
      b.shipDays.push(d);
      b.shipCount++;
      if (d <= 2) { shipped48++; b.shipped48++; }
    }
    if (o.deliveredDate) {
      const d = differenceInDays(o.deliveredDate, o.orderDate);
      deliverDays.push(d);
      b.deliverDays.push(d);
    }
    if (o.returnedDate) {
      const d = differenceInDays(o.returnedDate, o.orderDate);
      returnDays.push(d);
      b.returnDays.push(d);
    }
  }

  function countryRows(metric: FulfillmentSlaMetric): CountrySlaRow[] {
    const out: CountrySlaRow[] = [];
    for (const [country, b] of countryBuckets) {
      if (metric === "confirm" && b.confirmDays.length) {
        out.push({ country, value: avg(b.confirmDays), sampleCount: b.confirmDays.length });
      } else if (metric === "ship" && b.shipDays.length) {
        out.push({ country, value: avg(b.shipDays), sampleCount: b.shipDays.length });
      } else if (metric === "deliver" && b.deliverDays.length) {
        out.push({ country, value: avg(b.deliverDays), sampleCount: b.deliverDays.length });
      } else if (metric === "return" && b.returnDays.length) {
        out.push({ country, value: avg(b.returnDays), sampleCount: b.returnDays.length });
      } else if (metric === "shipped48h" && b.shipCount) {
        out.push({ country, value: b.shipped48 / b.shipCount, sampleCount: b.shipCount });
      }
    }
    return out.sort((a, b_) => (b_.value ?? 0) - (a.value ?? 0));
  }

  return {
    avgOrderToConfirmDays: avg(confirmDays),
    avgOrderToShipDays: avg(shipDays),
    avgOrderToDeliverDays: avg(deliverDays),
    avgOrderToReturnDays: avg(returnDays),
    shippedWithin48hPct: shipCount ? shipped48 / shipCount : 0,
    sampleSize: byOrder.size,
    byCountry: {
      confirm: countryRows("confirm"),
      ship: countryRows("ship"),
      deliver: countryRows("deliver"),
      return: countryRows("return"),
      shipped48h: countryRows("shipped48h"),
    },
  };
}

// ── Delivery partner breakdown ─────────────────────────────────────────────────

export interface DeliveryPartnerRow {
  name: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
  units: number;
  pct: number;
}

export interface DeliveryPartnerByCountryData {
  countries: string[];
  byCountry: Record<string, DeliveryPartnerRow[]>;
  orderCountByCountry: Record<string, number>;
}

function computeDeliveryPartnerBreakdown(rows: OrderRow[]): DeliveryPartnerRow[] {
  const byOrder = groupByOrderId(rows);
  const agg = new Map<string, { orders: Set<number>; delivered: Set<number>; units: number }>();

  for (const r of rows) {
    const key = r.deliveryPartner?.trim() || "Unknown";
    if (!agg.has(key)) agg.set(key, { orders: new Set(), delivered: new Set(), units: 0 });
    agg.get(key)!.units += r.quantity;
  }
  for (const [orderId, lines] of byOrder) {
    const key = lines[0].deliveryPartner?.trim() || "Unknown";
    if (!agg.has(key)) agg.set(key, { orders: new Set(), delivered: new Set(), units: 0 });
    const row = agg.get(key)!;
    row.orders.add(orderId);
    if (lines[0].status?.trim() === "Delivered") row.delivered.add(orderId);
  }

  const total = byOrder.size || 1;
  return [...agg.entries()].map(([name, v]) => ({
    name,
    orders: v.orders.size,
    deliveredOrders: v.delivered.size,
    deliveryRatio: v.orders.size > 0 ? v.delivered.size / v.orders.size : 0,
    units: v.units,
    pct: v.orders.size / total,
  })).sort((a, b) => b.orders - a.orders);
}

export function computeDeliveryPartnerBreakdownByCountry(rows: OrderRow[]): DeliveryPartnerByCountryData {
  const byOrder = groupByOrderId(rows);
  const countrySet = new Set<string>();
  const orderCountByCountry: Record<string, number> = { All: byOrder.size };

  for (const [, lines] of byOrder) {
    const c = lines[0].country?.trim() || "Unknown";
    countrySet.add(c);
    orderCountByCountry[c] = (orderCountByCountry[c] ?? 0) + 1;
  }

  const countries = [...countrySet].sort((a, b) => a.localeCompare(b));
  const byCountry: Record<string, DeliveryPartnerRow[]> = {
    All: computeDeliveryPartnerBreakdown(rows),
  };
  for (const c of countries) {
    byCountry[c] = computeDeliveryPartnerBreakdown(rows.filter((r) => (r.country?.trim() || "Unknown") === c));
  }

  return { countries: ["All", ...countries], byCountry, orderCountByCountry };
}

// ── Revenue loss breakdown ─────────────────────────────────────────────────────

export interface RevenueLossStatusSplit {
  status: string;
  orders: number;
  revenue: number;
  units: number;
  pct: number;
}

export interface RevenueLossTagSplit {
  name: string;
  orders: number;
  revenue: number;
  units: number;
  pct: number;
}

export interface RevenueLossRow {
  name: string;
  orders: number;
  revenue: number;
  units: number;
  pct: number;
  kind: "group" | "tag";
  tagSplits?: RevenueLossTagSplit[];
  statusSplits?: RevenueLossStatusSplit[];
}

function revenueLossDispatchLabel(status: string): string | null {
  const s = status.trim();
  if (s === "Cancelled" || s === "Canceled") return "Pre Dispatch";
  if (s === "Return" || s === "Return in Transit") return "Post Dispatch";
  return null;
}

export function computeRevenueLossBreakdown(rows: OrderRow[]): RevenueLossRow[] {
  const byOrder = groupByOrderId(rows);
  const byTag = new Map<string, {
    orders: Set<number>; revenue: number; units: number;
    byDispatch: Map<string, { orders: Set<number>; revenue: number; units: number }>;
  }>();

  let rlCount = 0;

  for (const r of rows) {
    const dispatch = revenueLossDispatchLabel(r.status ?? "");
    if (!dispatch) continue;
    const tag = (r.tag?.trim() || "No tag");
    if (!byTag.has(tag)) byTag.set(tag, { orders: new Set(), revenue: 0, units: 0, byDispatch: new Map() });
    byTag.get(tag)!.units += r.quantity;
    const bd = byTag.get(tag)!.byDispatch;
    if (!bd.has(dispatch)) bd.set(dispatch, { orders: new Set(), revenue: 0, units: 0 });
    bd.get(dispatch)!.units += r.quantity;
  }

  for (const [orderId, lines] of byOrder) {
    const dispatch = revenueLossDispatchLabel(lines[0].status ?? "");
    if (!dispatch) continue;
    rlCount++;
    const tag = (lines[0].tag?.trim() || "No tag");
    if (!byTag.has(tag)) byTag.set(tag, { orders: new Set(), revenue: 0, units: 0, byDispatch: new Map() });
    const row = byTag.get(tag)!;
    row.orders.add(orderId);
    row.revenue += lines[0].totalPayable;
    const bd = row.byDispatch;
    if (!bd.has(dispatch)) bd.set(dispatch, { orders: new Set(), revenue: 0, units: 0 });
    bd.get(dispatch)!.orders.add(orderId);
    bd.get(dispatch)!.revenue += lines[0].totalPayable;
  }

  const totalOrders = rlCount || 1;

  const tagRows = [...byTag.entries()].map(([name, v]) => {
    const tagOrders = v.orders.size || 1;
    const statusSplits: RevenueLossStatusSplit[] = [...v.byDispatch.entries()].map(([status, s]) => ({
      status,
      orders: s.orders.size,
      revenue: s.revenue,
      units: s.units,
      pct: s.orders.size / tagOrders,
    })).sort((a, b) => (a.status === "Pre Dispatch" ? -1 : 1) - (b.status === "Pre Dispatch" ? -1 : 1) || b.revenue - a.revenue);
    return { name, orders: v.orders.size, revenue: v.revenue, units: v.units, pct: v.orders.size / totalOrders, statusSplits };
  });

  const groupBuckets = new Map<string, { tags: typeof tagRows; orders: Set<number>; revenue: number; units: number }>();
  for (const g of REVENUE_LOSS_TAG_GROUPS) groupBuckets.set(g.heading, { tags: [], orders: new Set(), revenue: 0, units: 0 });
  const ungrouped: typeof tagRows = [];

  for (const tagRow of tagRows) {
    const heading = getRevenueLossGroup(tagRow.name);
    if (!heading) { ungrouped.push(tagRow); continue; }
    const bucket = groupBuckets.get(heading)!;
    bucket.tags.push(tagRow);
    for (const id of tagRow.statusSplits.flatMap((s) => [...(new Set<number>())])) bucket.orders.add(id);
    bucket.revenue += tagRow.revenue;
    bucket.units += tagRow.units;
    for (const s of tagRow.statusSplits) {
      for (const id of (s as { orders: number } & { _set?: Set<number> })._set ?? new Set<number>()) bucket.orders.add(id);
    }
  }

  const groupRows: RevenueLossRow[] = REVENUE_LOSS_TAG_GROUPS.map((g) => {
    const b = groupBuckets.get(g.heading)!;
    const groupOrders = b.orders.size || b.tags.reduce((s, t) => s + t.orders, 0) || 1;
    const tagSplits: RevenueLossTagSplit[] = b.tags.flatMap((t) =>
      t.statusSplits.map((s) => ({
        name: `${t.name} - ${s.status}`,
        orders: s.orders,
        revenue: s.revenue,
        units: s.units,
        pct: groupOrders > 0 ? s.orders / groupOrders : 0,
      }))
    ).sort((a, b_) => b_.revenue - a.revenue);

    const totalGroupOrders = b.tags.reduce((s, t) => s + t.orders, 0);
    return {
      name: g.heading, kind: "group" as const,
      orders: totalGroupOrders, revenue: b.revenue, units: b.units,
      pct: totalGroupOrders / totalOrders, tagSplits,
    };
  });

  const singleTagRows: RevenueLossRow[] = ungrouped.map((t) => ({
    name: t.name, kind: "tag" as const,
    orders: t.orders, revenue: t.revenue, units: t.units, pct: t.pct,
    statusSplits: t.statusSplits.map((s) => ({ ...s, status: `${t.name} - ${s.status}` })),
  })).sort((a, b) => b.revenue - a.revenue);

  return [...groupRows, ...singleTagRows.slice(0, 10)];
}

// ── Title breakdown (uses domain/store instead of account manager) ─────────────

export interface TitleStoreSplit {
  name: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
  units: number;
  pct: number;
}

export interface TitleBreakdownRow {
  name: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
  revenue: number;
  units: number;
  pct: number;
  storeSplits: TitleStoreSplit[];
}

export function computeTitleBreakdown(rows: OrderRow[], limit = 20): TitleBreakdownRow[] {
  const byOrder = groupByOrderId(rows);

  const agg = new Map<string, {
    orders: Set<number>; delivered: Set<number>; revenue: number; units: number;
    byStore: Map<string, { orders: Set<number>; delivered: Set<number>; units: number }>;
  }>();

  for (const r of rows) {
    const title = r.title?.trim() || "Unknown";
    const store = r.domain?.trim() || r.storeUrl?.trim() || `Store ${r.storeId}` || "Unknown";
    if (!agg.has(title)) agg.set(title, { orders: new Set(), delivered: new Set(), revenue: 0, units: 0, byStore: new Map() });
    agg.get(title)!.units += r.quantity;
    const bs = agg.get(title)!.byStore;
    if (!bs.has(store)) bs.set(store, { orders: new Set(), delivered: new Set(), units: 0 });
    bs.get(store)!.units += r.quantity;
  }

  for (const [orderId, lines] of byOrder) {
    const isDelivered = lines[0].status?.trim() === "Delivered";
    for (const line of lines) {
      const title = line.title?.trim() || "Unknown";
      const store = line.domain?.trim() || line.storeUrl?.trim() || `Store ${line.storeId}` || "Unknown";
      if (!agg.has(title)) agg.set(title, { orders: new Set(), delivered: new Set(), revenue: 0, units: 0, byStore: new Map() });
      const row = agg.get(title)!;
      row.orders.add(orderId);
      row.revenue += line.totalPayable;
      if (isDelivered) row.delivered.add(orderId);
      const bs = row.byStore;
      if (!bs.has(store)) bs.set(store, { orders: new Set(), delivered: new Set(), units: 0 });
      bs.get(store)!.orders.add(orderId);
      if (isDelivered) bs.get(store)!.delivered.add(orderId);
    }
  }

  const total = byOrder.size || 1;
  return [...agg.entries()].map(([name, v]) => {
    const orders = v.orders.size;
    const deliveredOrders = v.delivered.size;
    const titleOrders = orders || 1;
    const storeSplits: TitleStoreSplit[] = [...v.byStore.entries()].map(([sName, s]) => ({
      name: sName,
      orders: s.orders.size,
      deliveredOrders: s.delivered.size,
      deliveryRatio: s.orders.size > 0 ? s.delivered.size / s.orders.size : 0,
      units: s.units,
      pct: s.orders.size / titleOrders,
    })).sort((a, b) => b.orders - a.orders);

    return { name, orders, deliveredOrders, deliveryRatio: orders > 0 ? deliveredOrders / orders : 0, revenue: v.revenue, units: v.units, pct: orders / total, storeSplits };
  }).sort((a, b) => b.orders - a.orders).slice(0, limit);
}
