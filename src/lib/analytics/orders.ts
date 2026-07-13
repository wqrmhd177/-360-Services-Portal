import {
  eachDayOfInterval,
  format,
  startOfDay,
  differenceInDays,
  subDays,
} from "date-fns";
import type { DateRange, OrderFilters, OrderLineItem } from "@/lib/types/order";
import { dateRangeFromParamStrings } from "@/lib/calendar-range";
import { isInstantInCalendarRange } from "@/lib/calendar-range";
import { convertToUsd } from "@/lib/order-currency";
import { formatDateParam } from "@/lib/orders/params";
import { getResolvedPayable } from "@/lib/analytics/revenue-imputation";
import {
  getRevenueLossTagGroupHeading,
  REVENUE_LOSS_TAG_GROUPS,
} from "@/lib/operations/revenue-loss-tag-groups";

export function filterOrders(
  items: OrderLineItem[],
  range: DateRange,
  filters: OrderFilters = {}
): OrderLineItem[] {
  return items.filter((item) => {
    if (!isInstantInCalendarRange(item.orderDate, range)) return false;
    if (filters.countries?.length && !filters.countries.includes(item.country))
      return false;
    if (filters.statuses?.length && !filters.statuses.includes(item.status))
      return false;
    if (
      filters.bifurcations?.length &&
      !filters.bifurcations.includes(item.bifurcation)
    )
      return false;
    if (filters.platforms?.length && !filters.platforms.includes(item.platform))
      return false;
    if (
      filters.accountManagers?.length &&
      !filters.accountManagers.includes(item.accountManager)
    )
      return false;
    if (
      filters.deliveryPartners?.length &&
      !filters.deliveryPartners.includes(item.deliveryPartner)
    )
      return false;
    if (filters.sku && !item.sku.toLowerCase().includes(filters.sku.toLowerCase()))
      return false;
    if (filters.storeIds?.length && !filters.storeIds.includes(item.storeId))
      return false;
    if (filters.titles?.length && !filters.titles.includes(item.title))
      return false;
    return true;
  });
}

export type OrderGroupKey = string;
export type OrderGroupMap = Map<OrderGroupKey, OrderLineItem[]>;

const COUNTRY_ALIASES: Record<string, string> = {
  uae: "United Arab Emirates",
};

/** Metabase `id` — the unique order key for all counting and analytics (DB: order_id). */
export function getOrderGroupKey(item: OrderLineItem): OrderGroupKey {
  return `id:${item.metabaseId}`;
}

/** Metabase `id` (same as getOrderGroupKey numeric value). */
export function getLineId(item: OrderLineItem): number {
  return item.metabaseId;
}

export function normalizeOrderCountry(raw: string | undefined | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "Unknown";
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

export function groupByOrder(items: OrderLineItem[]): OrderGroupMap {
  const map = new Map<OrderGroupKey, OrderLineItem[]>();
  for (const item of items) {
    const key = getOrderGroupKey(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export type OrderFacetFilters = {
  country?: string | null;
  bifurcation?: string | null;
};

/** Status for an order (first non-empty line status, else Unknown). */
export function orderStatusFromLines(lines: OrderLineItem[]): string {
  const line = lines.find((l) => l.status?.trim());
  return line?.status?.trim() || "Unknown";
}

/** Representative country for an order (first non-empty line, normalized). */
export function orderCountryFromLines(lines: OrderLineItem[]): string {
  const line = lines.find((l) => l.country?.trim());
  return normalizeOrderCountry(line?.country);
}

/** Representative line for order-level date/SLA fields. */
export function orderRepresentativeLine(lines: OrderLineItem[]): OrderLineItem {
  return lines.find((l) => l.orderDate) ?? lines[0];
}

/**
 * Facet rules per Metabase id (each row is one order):
 * - All countries / bifurcations → field is populated on this id
 * - Specific value → field matches on this id
 */
export function orderMatchesFacetFilters(
  lines: OrderLineItem[],
  filters: OrderFacetFilters,
): boolean {
  const country = filters.country?.trim() || null;
  const bifurcation = filters.bifurcation?.trim() || null;

  const countryOk = country
    ? lines.some((l) => normalizeOrderCountry(l.country) === normalizeOrderCountry(country))
    : lines.some((l) => Boolean(l.country?.trim()));

  const bifurcationOk = bifurcation
    ? lines.some((l) => l.bifurcation?.trim() === bifurcation)
    : lines.some((l) => Boolean(l.bifurcation?.trim()));

  return countryOk && bifurcationOk;
}

/** Keep all lines for Metabase ids that pass country/bifurcation rules. */
export function applyOrderLevelFacetFilters(
  items: OrderLineItem[],
  filters: OrderFacetFilters,
): OrderLineItem[] {
  const byOrder = groupByOrder(items);
  const matchingKeys = new Set<OrderGroupKey>();
  for (const [orderKey, lines] of byOrder) {
    if (orderMatchesFacetFilters(lines, filters)) matchingKeys.add(orderKey);
  }
  return items.filter((item) => matchingKeys.has(getOrderGroupKey(item)));
}

/** Order revenue in USD (sum of lines; uses resolvedPayable when imputed). */
export function orderRevenue(lines: OrderLineItem[]) {
  if (lines.length === 0) return 0;
  return lines.reduce(
    (sum, line) =>
      sum + convertToUsd(getResolvedPayable(line), line.country, line.sku, line.currencyCode),
    0,
  );
}

/** Local-currency order total (sum of resolved payables across lines). */
export function orderRevenueLocal(lines: OrderLineItem[]) {
  if (lines.length === 0) return 0;
  return lines.reduce((sum, line) => sum + getResolvedPayable(line), 0);
}

export interface OrderKPIs {
  totalOrders: number;
  grossRevenue: number;
  aov: number;
  unitsSold: number;
  deliveredRate: number;
  returnRate: number;
  avgItemsPerOrder: number;
}

export function computeKPIs(items: OrderLineItem[]): OrderKPIs {
  const byOrder = groupByOrder(items);
  const orderIds = [...byOrder.keys()];
  const totalOrders = orderIds.length;
  let grossRevenue = 0;
  let delivered = 0;
  let returned = 0;

  for (const [, lines] of byOrder) {
    grossRevenue += orderRevenue(lines);
    const status = orderStatusFromLines(lines);
    if (status === "Delivered") delivered++;
    if (status === "Return" || status === "Returned") returned++;
  }

  const unitsSold = items.reduce((s, i) => s + i.quantity, 0);
  const avgItemsPerOrder = totalOrders ? unitsSold / totalOrders : 0;

  return {
    totalOrders,
    grossRevenue,
    aov: totalOrders ? grossRevenue / totalOrders : 0,
    unitsSold,
    deliveredRate: totalOrders ? delivered / totalOrders : 0,
    returnRate: totalOrders ? returned / totalOrders : 0,
    avgItemsPerOrder,
  };
}

export interface TrendPoint {
  date: string;
  orders: number;
  revenue: number;
  units: number;
}

export function computeTrends(items: OrderLineItem[], range: DateRange): TrendPoint[] {
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  const byOrder = groupByOrder(items);

  const ordersByDay = new Map<string, Set<OrderGroupKey>>();
  const revenueByDay = new Map<string, number>();
  const unitsByDay = new Map<string, number>();

  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    ordersByDay.set(key, new Set());
    revenueByDay.set(key, 0);
    unitsByDay.set(key, 0);
  }

  for (const [orderKey, lines] of byOrder) {
    const rep = orderRepresentativeLine(lines);
    const key = format(startOfDay(rep.orderDate), "yyyy-MM-dd");
    if (!ordersByDay.has(key)) continue;
    ordersByDay.get(key)!.add(orderKey);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + orderRevenue(lines));
  }

  for (const item of items) {
    const key = format(startOfDay(item.orderDate), "yyyy-MM-dd");
    if (unitsByDay.has(key)) {
      unitsByDay.set(key, (unitsByDay.get(key) ?? 0) + item.quantity);
    }
  }

  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    return {
      date: key,
      orders: ordersByDay.get(key)?.size ?? 0,
      revenue: revenueByDay.get(key) ?? 0,
      units: unitsByDay.get(key) ?? 0,
    };
  });
}

export interface BreakdownRow {
  name: string;
  /** Order status when row is split by status (e.g. Revenue Loss). */
  status?: string;
  orders: number;
  revenue: number;
  units: number;
  pct: number;
}

function breakdownBy(
  items: OrderLineItem[],
  keyFn: (i: OrderLineItem) => string
): BreakdownRow[] {
  const byOrder = groupByOrder(items);
  const agg = new Map<string, { orders: Set<OrderGroupKey>; revenue: number; units: number }>();

  for (const item of items) {
    const key = keyFn(item) || "Unknown";
    if (!agg.has(key)) agg.set(key, { orders: new Set(), revenue: 0, units: 0 });
    const row = agg.get(key)!;
    row.units += item.quantity;
    agg.set(key, row);
  }

  for (const [orderKey, lines] of byOrder) {
    const keysInOrder = new Set<string>();
    for (const line of lines) {
      keysInOrder.add(keyFn(line) || "Unknown");
    }
    const revShare =
      keysInOrder.size > 0 ? orderRevenue(lines) / keysInOrder.size : 0;
    for (const key of keysInOrder) {
      if (!agg.has(key)) agg.set(key, { orders: new Set(), revenue: 0, units: 0 });
      const row = agg.get(key)!;
      row.orders.add(orderKey);
      row.revenue += revShare;
    }
  }

  const totalOrders = byOrder.size || 1;
  return [...agg.entries()]
    .map(([name, v]) => ({
      name,
      orders: v.orders.size,
      revenue: v.revenue,
      units: v.units,
      pct: v.orders.size / totalOrders,
    }))
    .sort((a, b) => b.orders - a.orders);
}

export function computeStatusBreakdown(items: OrderLineItem[]) {
  return breakdownBy(items, (i) => i.status);
}

export function computeTagBreakdown(items: OrderLineItem[]) {
  return breakdownBy(items, (i) => i.tag);
}

export function computeCountryBreakdown(items: OrderLineItem[]) {
  return breakdownBy(items, (i) => normalizeOrderCountry(i.country));
}

export interface CountryDeliveryRow {
  country: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
}

/** Delivered orders ÷ all orders per country (order-level status from lines[0]). */
export function computeCountryDeliveryRatios(
  items: OrderLineItem[],
): CountryDeliveryRow[] {
  const byOrder = groupByOrder(items);
  const allByCountry = new Map<string, Set<OrderGroupKey>>();
  const deliveredByCountry = new Map<string, Set<OrderGroupKey>>();

  for (const [orderKey, lines] of byOrder) {
    if (lines.length === 0) continue;
    const country = orderCountryFromLines(lines);
    if (!allByCountry.has(country)) allByCountry.set(country, new Set());
    allByCountry.get(country)!.add(orderKey);
    if (orderStatusFromLines(lines) === "Delivered") {
      if (!deliveredByCountry.has(country)) {
        deliveredByCountry.set(country, new Set());
      }
      deliveredByCountry.get(country)!.add(orderKey);
    }
  }

  return [...allByCountry.entries()]
    .map(([country, orderIds]) => {
      const orders = orderIds.size;
      const deliveredOrders = deliveredByCountry.get(country)?.size ?? 0;
      return {
        country,
        orders,
        deliveredOrders,
        deliveryRatio: orders > 0 ? deliveredOrders / orders : 0,
      };
    })
    .sort((a, b) => {
      const orderCmp = b.orders - a.orders;
      if (orderCmp !== 0) return orderCmp;
      return a.country.localeCompare(b.country);
    });
}

export function computeCityBreakdown(items: OrderLineItem[], limit = 10) {
  return breakdownBy(items, (i) => i.city).slice(0, limit);
}

export function computeSkuBreakdown(items: OrderLineItem[], limit = 15) {
  return breakdownBy(items, (i) => i.sku).slice(0, limit);
}

export interface TitleCountrySplit {
  name: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
  units: number;
  /** Share of parent account-manager orders */
  pct: number;
}

export interface TitleAccountManagerSplit {
  name: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
  units: number;
  /** Share of parent title orders */
  pct: number;
  countrySplits: TitleCountrySplit[];
}

export interface TitleBreakdownRow extends BreakdownRow {
  deliveredOrders: number;
  deliveryRatio: number;
  accountManagerSplits: TitleAccountManagerSplit[];
}

type TitleCountryBucket = {
  orders: Set<OrderGroupKey>;
  delivered: Set<OrderGroupKey>;
  units: number;
};

type TitleAccountManagerBucket = {
  orders: Set<OrderGroupKey>;
  delivered: Set<OrderGroupKey>;
  units: number;
  byCountry: Map<string, TitleCountryBucket>;
};

function emptyTitleAgg() {
  return {
    orders: new Set<OrderGroupKey>(),
    delivered: new Set<OrderGroupKey>(),
    revenue: 0,
    units: 0,
    byAccountManager: new Map<string, TitleAccountManagerBucket>(),
  };
}

function emptyCountryBucket(): TitleCountryBucket {
  return { orders: new Set(), delivered: new Set(), units: 0 };
}

function titleCountryBucket(
  amRow: TitleAccountManagerBucket,
  country: string,
): TitleCountryBucket {
  if (!amRow.byCountry.has(country)) {
    amRow.byCountry.set(country, emptyCountryBucket());
  }
  return amRow.byCountry.get(country)!;
}

function titleAccountManagerBucket(
  agg: ReturnType<typeof emptyTitleAgg>,
  accountManager: string,
): TitleAccountManagerBucket {
  if (!agg.byAccountManager.has(accountManager)) {
    agg.byAccountManager.set(accountManager, {
      orders: new Set(),
      delivered: new Set(),
      units: 0,
      byCountry: new Map(),
    });
  }
  return agg.byAccountManager.get(accountManager)!;
}

function mapCountrySplits(
  byCountry: Map<string, TitleCountryBucket>,
  parentOrders: number,
): TitleCountrySplit[] {
  const parentOrderCount = parentOrders || 1;
  return [...byCountry.entries()]
    .map(([countryName, country]) => {
      const orders = country.orders.size;
      const deliveredOrders = country.delivered.size;
      return {
        name: countryName,
        orders,
        deliveredOrders,
        deliveryRatio: orders > 0 ? deliveredOrders / orders : 0,
        units: country.units,
        pct: orders / parentOrderCount,
      };
    })
    .filter((split) => split.orders > 0 || split.units > 0)
    .sort((a, b) => b.orders - a.orders);
}

/** Product title breakdown with account-manager splits and delivery ratio. */
export function computeTitleBreakdown(
  items: OrderLineItem[],
  limit = 15,
): TitleBreakdownRow[] {
  const byOrder = groupByOrder(items);
  const agg = new Map<string, ReturnType<typeof emptyTitleAgg>>();

  for (const item of items) {
    const title = item.title?.trim() || "Unknown";
    const accountManager = item.accountManager?.trim() || "Unknown";
    const country = normalizeOrderCountry(item.country);
    if (!agg.has(title)) agg.set(title, emptyTitleAgg());
    const row = agg.get(title)!;
    row.units += item.quantity;
    const amRow = titleAccountManagerBucket(row, accountManager);
    amRow.units += item.quantity;
    const countryRow = titleCountryBucket(amRow, country);
    countryRow.units += item.quantity;
  }

  for (const [orderKey, lines] of byOrder) {
    const status = orderStatusFromLines(lines);
    const isDelivered = status === "Delivered";
    const byTitle = new Map<string, OrderLineItem[]>();
    for (const line of lines) {
      const title = line.title?.trim() || "Unknown";
      const list = byTitle.get(title) ?? [];
      list.push(line);
      byTitle.set(title, list);
    }
    for (const [title, titleLines] of byTitle) {
      if (!agg.has(title)) agg.set(title, emptyTitleAgg());
      const row = agg.get(title)!;
      row.orders.add(orderKey);
      row.revenue += orderRevenue(titleLines);
      if (isDelivered) row.delivered.add(orderKey);
      for (const line of titleLines) {
        const accountManager = line.accountManager?.trim() || "Unknown";
        const country = normalizeOrderCountry(line.country);
        const amRow = titleAccountManagerBucket(row, accountManager);
        amRow.orders.add(orderKey);
        const countryRow = titleCountryBucket(amRow, country);
        countryRow.orders.add(orderKey);
        if (isDelivered) {
          amRow.delivered.add(orderKey);
          countryRow.delivered.add(orderKey);
        }
      }
    }
  }

  const totalOrders = byOrder.size || 1;
  return [...agg.entries()]
    .map(([name, v]) => {
      const orders = v.orders.size;
      const deliveredOrders = v.delivered.size;
      const titleOrders = orders || 1;
      const accountManagerSplits: TitleAccountManagerSplit[] = [
        ...v.byAccountManager.entries(),
      ]
        .map(([amName, am]) => {
          const amOrders = am.orders.size;
          const amDelivered = am.delivered.size;
          return {
            name: amName,
            orders: amOrders,
            deliveredOrders: amDelivered,
            deliveryRatio: amOrders > 0 ? amDelivered / amOrders : 0,
            units: am.units,
            pct: amOrders / titleOrders,
            countrySplits: mapCountrySplits(am.byCountry, amOrders),
          };
        })
        .filter((split) => split.orders > 0 || split.units > 0)
        .sort((a, b) => b.orders - a.orders);

      return {
        name,
        orders,
        deliveredOrders,
        deliveryRatio: orders > 0 ? deliveredOrders / orders : 0,
        revenue: v.revenue,
        units: v.units,
        pct: orders / totalOrders,
        accountManagerSplits,
      };
    })
    .sort((a, b) => b.orders - a.orders)
    .slice(0, limit);
}

export function computeBifurcationBreakdown(items: OrderLineItem[]) {
  return breakdownBy(items, (i) => i.bifurcation);
}

export function computePlatformBreakdown(items: OrderLineItem[]) {
  return breakdownBy(items, (i) => i.platform);
}

export function computeAccountManagerBreakdown(items: OrderLineItem[]) {
  return breakdownBy(items, (i) => i.accountManager);
}

export interface TitleDeliveryRow {
  title: string;
  orders: number;
  deliveredOrders: number;
  deliveryRatio: number;
}

function normalizeAccountManager(value: string | undefined | null): string {
  return value?.trim() || "Unknown";
}

/** Product titles for one account manager with delivered ÷ orders (order-level status). */
export function computeTitleDeliveryBreakdownForAccountManager(
  items: OrderLineItem[],
  accountManager: string,
): TitleDeliveryRow[] {
  const amKey = normalizeAccountManager(accountManager);
  const scoped = items.filter(
    (item) => normalizeAccountManager(item.accountManager) === amKey,
  );
  const byOrder = groupByOrder(scoped);
  const allByTitle = new Map<string, Set<OrderGroupKey>>();
  const deliveredByTitle = new Map<string, Set<OrderGroupKey>>();

  for (const [orderKey, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    if (!line) continue;
    const title = line.title?.trim() || "Unknown";
    if (!allByTitle.has(title)) allByTitle.set(title, new Set());
    allByTitle.get(title)!.add(orderKey);
    if (orderStatusFromLines(lines) === "Delivered") {
      if (!deliveredByTitle.has(title)) {
        deliveredByTitle.set(title, new Set());
      }
      deliveredByTitle.get(title)!.add(orderKey);
    }
  }

  return [...allByTitle.entries()]
    .map(([title, orderIds]) => {
      const orders = orderIds.size;
      const deliveredOrders = deliveredByTitle.get(title)?.size ?? 0;
      return {
        title,
        orders,
        deliveredOrders,
        deliveryRatio: orders > 0 ? deliveredOrders / orders : 0,
      };
    })
    .sort((a, b) => {
      const orderCmp = b.orders - a.orders;
      if (orderCmp !== 0) return orderCmp;
      return a.title.localeCompare(b.title);
    });
}

export interface DeliveryPartnerRow extends BreakdownRow {
  deliveredOrders: number;
  deliveryRatio: number;
}

/** Orders per delivery partner with delivered ÷ assigned ratio (order-level status). */
export function computeDeliveryPartnerBreakdown(
  items: OrderLineItem[],
): DeliveryPartnerRow[] {
  const byOrder = groupByOrder(items);
  const agg = new Map<
    string,
    { orders: Set<OrderGroupKey>; delivered: Set<OrderGroupKey>; revenue: number; units: number }
  >();

  for (const item of items) {
    const key = item.deliveryPartner?.trim() || "Unknown";
    if (!agg.has(key)) {
      agg.set(key, { orders: new Set(), delivered: new Set(), revenue: 0, units: 0 });
    }
    agg.get(key)!.units += item.quantity;
  }

  for (const [orderKey, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    const key = line.deliveryPartner?.trim() || "Unknown";
    if (!agg.has(key)) {
      agg.set(key, { orders: new Set(), delivered: new Set(), revenue: 0, units: 0 });
    }
    const row = agg.get(key)!;
    row.orders.add(orderKey);
    row.revenue += orderRevenue(lines);
    if (orderStatusFromLines(lines) === "Delivered") {
      row.delivered.add(orderKey);
    }
  }

  const totalOrders = byOrder.size || 1;
  return [...agg.entries()]
    .map(([name, v]) => {
      const orders = v.orders.size;
      const deliveredOrders = v.delivered.size;
      return {
        name,
        orders,
        deliveredOrders,
        deliveryRatio: orders > 0 ? deliveredOrders / orders : 0,
        revenue: v.revenue,
        units: v.units,
        pct: orders / totalOrders,
      };
    })
    .sort((a, b) => b.orders - a.orders);
}

export interface DeliveryPartnerByCountryData {
  countries: string[];
  byCountry: Record<string, DeliveryPartnerRow[]>;
  orderCountByCountry: Record<string, number>;
}

export function computeDeliveryPartnerBreakdownByCountry(
  items: OrderLineItem[],
): DeliveryPartnerByCountryData {
  const byOrder = groupByOrder(items);
  const countrySet = new Set<string>();
  const orderCountByCountry: Record<string, number> = { All: byOrder.size };

  for (const [, lines] of byOrder) {
    const country = orderCountryFromLines(lines);
    countrySet.add(country);
    orderCountByCountry[country] = (orderCountByCountry[country] ?? 0) + 1;
  }

  const countries = [...countrySet].sort((a, b) => a.localeCompare(b));
  const byCountry: Record<string, DeliveryPartnerRow[]> = {
    All: computeDeliveryPartnerBreakdown(items),
  };

  for (const country of countries) {
    const countryItems = items.filter(
      (i) => normalizeOrderCountry(i.country) === country,
    );
    byCountry[country] = computeDeliveryPartnerBreakdown(countryItems);
  }

  return {
    countries: ["All", ...countries],
    byCountry,
    orderCountByCountry,
  };
}

export const REVENUE_LOSS_DISPATCH_LABELS = {
  pre: "Pre Dispatch",
  post: "Post Dispatch",
} as const;

function revenueLossDispatchLabel(rawStatus: string): string | null {
  const status = rawStatus.trim();
  if (status === "Cancelled" || status === "Canceled") {
    return REVENUE_LOSS_DISPATCH_LABELS.pre;
  }
  if (status === "Return" || status === "Return in Transit") {
    return REVENUE_LOSS_DISPATCH_LABELS.post;
  }
  return null;
}

function normalizeBreakdownTag(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No tag";
}

function revenueLossTagDispatchLabel(tag: string, dispatch: string): string {
  return `${tag} - ${dispatch}`;
}

export function parseRevenueLossTagDispatchLabel(
  label: string,
): { tag: string; dispatch: string } | null {
  for (const dispatch of Object.values(REVENUE_LOSS_DISPATCH_LABELS)) {
    const suffix = ` - ${dispatch}`;
    if (label.endsWith(suffix)) {
      return { tag: label.slice(0, -suffix.length), dispatch };
    }
  }
  return null;
}

export interface RevenueLossStatusSplit {
  /** Pre Dispatch or Post Dispatch */
  status: string;
  orders: number;
  revenue: number;
  units: number;
  /** Share of this tag's orders */
  pct: number;
}

export interface RevenueLossTagSplit {
  name: string;
  orders: number;
  revenue: number;
  units: number;
  /** Share of parent group orders */
  pct: number;
}

export interface RevenueLossRow {
  name: string;
  orders: number;
  revenue: number;
  units: number;
  /** Share of all revenue-loss orders */
  pct: number;
  kind: "group" | "tag";
  /** Clubbed heading → tag + Pre/Post Dispatch rows */
  tagSplits?: RevenueLossTagSplit[];
  /** Ungrouped tag → tag + Pre/Post Dispatch rows */
  statusSplits?: RevenueLossStatusSplit[];
}

/** Revenue Loss: by tag (top 10 revenue), expandable tag + Pre/Post Dispatch split. */
export function computeRevenueLossBreakdown(
  items: OrderLineItem[],
): RevenueLossRow[] {
  const byOrder = groupByOrder(items);
  const byTag = new Map<
    string,
    {
      orders: Set<OrderGroupKey>;
      revenue: number;
      units: number;
      byDispatch: Map<
        string,
        { orders: Set<OrderGroupKey>; revenue: number; units: number }
      >;
    }
  >();

  let revenueLossOrderCount = 0;

  for (const item of items) {
    const dispatch = revenueLossDispatchLabel(item.status ?? "");
    if (!dispatch) continue;

    const tag = normalizeBreakdownTag(item.tag);
    if (!byTag.has(tag)) {
      byTag.set(tag, {
        orders: new Set(),
        revenue: 0,
        units: 0,
        byDispatch: new Map(),
      });
    }
    const row = byTag.get(tag)!;
    row.units += item.quantity;

    if (!row.byDispatch.has(dispatch)) {
      row.byDispatch.set(dispatch, {
        orders: new Set(),
        revenue: 0,
        units: 0,
      });
    }
    row.byDispatch.get(dispatch)!.units += item.quantity;
  }

  for (const [orderKey, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    const dispatch = revenueLossDispatchLabel(line.status ?? "");
    if (!dispatch) continue;

    revenueLossOrderCount++;
    const tag = normalizeBreakdownTag(line.tag);
    if (!byTag.has(tag)) {
      byTag.set(tag, {
        orders: new Set(),
        revenue: 0,
        units: 0,
        byDispatch: new Map(),
      });
    }
    const row = byTag.get(tag)!;
    row.orders.add(orderKey);
    row.revenue += orderRevenue(lines);

    if (!row.byDispatch.has(dispatch)) {
      row.byDispatch.set(dispatch, {
        orders: new Set(),
        revenue: 0,
        units: 0,
      });
    }
    const split = row.byDispatch.get(dispatch)!;
    split.orders.add(orderKey);
    split.revenue += orderRevenue(lines);
  }

  const totalOrders = revenueLossOrderCount || 1;

  const tagRows = [...byTag.entries()].map(([name, v]) => {
    const tagOrders = v.orders.size || 1;
    const statusSplits: RevenueLossStatusSplit[] = [...v.byDispatch.entries()]
      .map(([status, split]) => ({
        status,
        orders: split.orders.size,
        revenue: split.revenue,
        units: split.units,
        pct: split.orders.size / tagOrders,
      }))
      .sort((a, b) => {
        if (
          a.status === REVENUE_LOSS_DISPATCH_LABELS.pre &&
          b.status !== REVENUE_LOSS_DISPATCH_LABELS.pre
        ) {
          return -1;
        }
        if (
          b.status === REVENUE_LOSS_DISPATCH_LABELS.pre &&
          a.status !== REVENUE_LOSS_DISPATCH_LABELS.pre
        ) {
          return 1;
        }
        return b.revenue - a.revenue;
      });

    return {
      name,
      orders: v.orders.size,
      revenue: v.revenue,
      units: v.units,
      pct: v.orders.size / totalOrders,
      statusSplits,
      raw: v,
    };
  });

  const groupBuckets = new Map<
    string,
    { tags: typeof tagRows; orders: Set<OrderGroupKey>; revenue: number; units: number }
  >();

  for (const config of REVENUE_LOSS_TAG_GROUPS) {
    groupBuckets.set(config.heading, {
      tags: [],
      orders: new Set(),
      revenue: 0,
      units: 0,
    });
  }

  const ungrouped: typeof tagRows = [];

  for (const tagRow of tagRows) {
    const heading = getRevenueLossTagGroupHeading(tagRow.name);
    if (!heading) {
      ungrouped.push(tagRow);
      continue;
    }
    const bucket = groupBuckets.get(heading)!;
    bucket.tags.push(tagRow);
    for (const id of tagRow.raw.orders) bucket.orders.add(id);
    bucket.revenue += tagRow.revenue;
    bucket.units += tagRow.units;
  }

  const groupRows: RevenueLossRow[] = [];

  for (const config of REVENUE_LOSS_TAG_GROUPS) {
    const bucket = groupBuckets.get(config.heading)!;
    const groupOrders = bucket.orders.size || 1;
    const tagSplits: RevenueLossTagSplit[] = bucket.tags
      .flatMap((t) =>
        t.statusSplits.map((s) => ({
          name: revenueLossTagDispatchLabel(t.name, s.status),
          orders: s.orders,
          revenue: s.revenue,
          units: s.units,
          pct: groupOrders > 0 ? s.orders / groupOrders : 0,
        })),
      )
      .sort((a, b) => b.revenue - a.revenue);

    groupRows.push({
      name: config.heading,
      kind: "group",
      orders: bucket.orders.size,
      revenue: bucket.revenue,
      units: bucket.units,
      pct: bucket.orders.size / totalOrders,
      tagSplits,
    });
  }

  const singleTagRows: RevenueLossRow[] = ungrouped.map((t) => ({
    name: t.name,
    kind: "tag",
    orders: t.orders,
    revenue: t.revenue,
    units: t.units,
    pct: t.pct,
    statusSplits: t.statusSplits.map((s) => ({
      ...s,
      status: revenueLossTagDispatchLabel(t.name, s.status),
    })),
  }));

  const sortedUngrouped = singleTagRows.sort((a, b) => b.revenue - a.revenue);

  /** Always list all configured club headings; append unmapped tags up to 10 extra rows. */
  return [...groupRows, ...sortedUngrouped.slice(0, 10)];
}

export type FulfillmentSlaMetric =
  | "confirm"
  | "ship"
  | "deliver"
  | "return"
  | "shipped48h";

export interface CountrySlaRow {
  country: string;
  value: number | null;
  sampleCount: number;
}

interface CountrySlaBucket {
  confirmDays: number[];
  deliverDays: number[];
  returnDays: number[];
  shipDays: number[];
  shipped48: number;
  shipCount: number;
}

function emptyCountrySlaBucket(): CountrySlaBucket {
  return {
    confirmDays: [],
    deliverDays: [],
    returnDays: [],
    shipDays: [],
    shipped48: 0,
    shipCount: 0,
  };
}

function avgDays(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function countrySlaRows(
  buckets: Map<string, CountrySlaBucket>,
  metric: FulfillmentSlaMetric,
): CountrySlaRow[] {
  const rows: CountrySlaRow[] = [];

  for (const [country, bucket] of buckets) {
    if (metric === "confirm") {
      if (bucket.confirmDays.length === 0) continue;
      rows.push({
        country,
        value: avgDays(bucket.confirmDays),
        sampleCount: bucket.confirmDays.length,
      });
    } else if (metric === "ship") {
      if (bucket.shipDays.length === 0) continue;
      rows.push({
        country,
        value: avgDays(bucket.shipDays),
        sampleCount: bucket.shipDays.length,
      });
    } else if (metric === "deliver") {
      if (bucket.deliverDays.length === 0) continue;
      rows.push({
        country,
        value: avgDays(bucket.deliverDays),
        sampleCount: bucket.deliverDays.length,
      });
    } else if (metric === "return") {
      if (bucket.returnDays.length === 0) continue;
      rows.push({
        country,
        value: avgDays(bucket.returnDays),
        sampleCount: bucket.returnDays.length,
      });
    } else if (metric === "shipped48h") {
      if (bucket.shipCount === 0) continue;
      rows.push({
        country,
        value: bucket.shipped48 / bucket.shipCount,
        sampleCount: bucket.shipCount,
      });
    }
  }

  return rows.sort((a, b) => {
    const av = a.value ?? -1;
    const bv = b.value ?? -1;
    return bv - av;
  });
}

export interface FulfillmentSLA {
  avgOrderToConfirmDays: number | null;
  avgOrderToDeliverDays: number | null;
  avgOrderToReturnDays: number | null;
  avgOrderToShipDays: number | null;
  shippedWithin48hPct: number;
  sampleSize: number;
  byCountry: Record<FulfillmentSlaMetric, CountrySlaRow[]>;
}

export function computeFulfillmentSLA(items: OrderLineItem[]): FulfillmentSLA {
  const byOrder = groupByOrder(items);
  const confirmDays: number[] = [];
  const deliverDays: number[] = [];
  const returnDays: number[] = [];
  const shipDays: number[] = [];
  const countryBuckets = new Map<string, CountrySlaBucket>();
  let shipped48 = 0;
  let shipCount = 0;

  for (const [, lines] of byOrder) {
    const o = orderRepresentativeLine(lines);
    const country = orderCountryFromLines(lines);
    if (!countryBuckets.has(country)) {
      countryBuckets.set(country, emptyCountrySlaBucket());
    }
    const bucket = countryBuckets.get(country)!;

    if (o.approvedDate) {
      const days = differenceInDays(o.approvedDate, o.orderDate);
      confirmDays.push(days);
      bucket.confirmDays.push(days);
    }
    if (o.deliveredDate) {
      const days = differenceInDays(o.deliveredDate, o.orderDate);
      deliverDays.push(days);
      bucket.deliverDays.push(days);
    }
    if (o.returnedDate) {
      const days = differenceInDays(o.returnedDate, o.orderDate);
      returnDays.push(days);
      bucket.returnDays.push(days);
    }
    if (o.shipmentDate) {
      const d = differenceInDays(o.shipmentDate, o.orderDate);
      shipDays.push(d);
      shipCount++;
      bucket.shipDays.push(d);
      bucket.shipCount++;
      if (d <= 2) {
        shipped48++;
        bucket.shipped48++;
      }
    }
  }

  const avg = avgDays;

  return {
    avgOrderToConfirmDays: avg(confirmDays),
    avgOrderToDeliverDays: avg(deliverDays),
    avgOrderToReturnDays: avg(returnDays),
    avgOrderToShipDays: avg(shipDays),
    shippedWithin48hPct: shipCount ? shipped48 / shipCount : 0,
    sampleSize: byOrder.size,
    byCountry: {
      confirm: countrySlaRows(countryBuckets, "confirm"),
      ship: countrySlaRows(countryBuckets, "ship"),
      deliver: countrySlaRows(countryBuckets, "deliver"),
      return: countrySlaRows(countryBuckets, "return"),
      shipped48h: countrySlaRows(countryBuckets, "shipped48h"),
    },
  };
}

export function getFilterOptions(items: OrderLineItem[]) {
  const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();
  return {
    countries: uniq(items.map((i) => i.country)),
    statuses: uniq(items.map((i) => i.status)),
    bifurcations: uniq(items.map((i) => i.bifurcation)),
    platforms: uniq(items.map((i) => i.platform)),
    accountManagers: uniq(items.map((i) => i.accountManager)),
    deliveryPartners: uniq(items.map((i) => i.deliveryPartner)),
    storeIds: [...new Set(items.map((i) => i.storeId).filter((id) => id > 0))].sort(
      (a, b) => a - b,
    ),
    titles: uniq(items.map((i) => i.title)),
  };
}

export function defaultDateRange(): DateRange {
  const to = new Date();
  const from = subDays(to, 30);
  return dateRangeFromParamStrings(
    formatDateParam(from),
    formatDateParam(to),
  );
}
