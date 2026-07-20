import type { OperationsStatusCounts } from "@/lib/analytics/operations-status-detail";
import {
  REVENUE_LOSS_DISPATCH_LABELS,
  type DeliveryPartnerByCountryData,
  type DeliveryPartnerRow,
  type FulfillmentSLA,
  type FulfillmentSlaMetric,
  type RevenueLossRow,
} from "@/lib/analytics/orders";
import {
  OPERATIONS_STATUS_KPI_GROUPS,
  type OperationsStatusGroupId,
} from "@/lib/operations/status-kpi-groups";
import {
  getRevenueLossTagGroupHeading,
  REVENUE_LOSS_TAG_GROUPS,
} from "@/lib/operations/revenue-loss-tag-groups";
import {
  type OrdersFilterParams,
  fetchOperationsStatusCountsFromLineItems,
  toRpcFilterParams,
} from "@/lib/orders/filteredItems";
import { fetchOrdersRollupRows } from "@/lib/orders/rollupQuery";
import { getOpsDb } from "@/lib/operations/opsDb";

type StatusRollupDbRow = {
  status: string | null;
  order_count: number | null;
};

type DeliveryPartnerRollupRow = {
  country: string | null;
  delivery_partner: string | null;
  status: string | null;
  order_count: number | null;
  revenue_usd: number | null;
  units: number | null;
};

type RevenueLossRollupRow = {
  tag: string | null;
  dispatch_label: string | null;
  order_count: number | null;
  revenue_usd: number | null;
  units: number | null;
};

type SlaRollupRow = {
  country: string | null;
  confirm_days_sum: number | null;
  confirm_count: number | null;
  deliver_days_sum: number | null;
  deliver_count: number | null;
  return_days_sum: number | null;
  return_count: number | null;
  ship_days_sum: number | null;
  ship_count: number | null;
  shipped_within_48h_count: number | null;
};

function normalizeTag(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No tag";
}

function revenueLossTagDispatchLabel(tag: string, dispatch: string): string {
  return `${tag} - ${dispatch}`;
}

export function mapStatusRollupRows(rows: StatusRollupDbRow[]): OperationsStatusCounts {
  const byStatus = new Map<string, number>();
  let totalOrders = 0;

  for (const row of rows) {
    const status = row.status?.trim() || "Unknown";
    const count = Number(row.order_count ?? 0);
    byStatus.set(status, (byStatus.get(status) ?? 0) + count);
    totalOrders += count;
  }

  const byGroup = Object.fromEntries(
    OPERATIONS_STATUS_KPI_GROUPS.map((group) => {
      let n = 0;
      for (const status of group.statuses) {
        n += byStatus.get(status) ?? 0;
      }
      return [group.id, n];
    }),
  ) as Record<OperationsStatusGroupId, number>;

  return {
    totalOrders,
    deliveredOrders: byStatus.get("Delivered") ?? 0,
    byGroup,
  };
}

export async function fetchOperationsStatusCounts(
  filters: OrdersFilterParams,
): Promise<OperationsStatusCounts> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc(
    "get_ops_orders_status_counts",
    toRpcFilterParams(filters),
  );

  if (!error && data != null) {
    const rows = (Array.isArray(data) ? data : []) as StatusRollupDbRow[];
    return mapStatusRollupRows(rows);
  }

  const rows = await fetchOperationsStatusCountsFromLineItems(filters);
  return mapStatusRollupRows(rows);
}

function buildDeliveryPartnerRows(
  rows: DeliveryPartnerRollupRow[],
  totalOrders: number,
): DeliveryPartnerRow[] {
  const agg = new Map<
    string,
    { orders: number; deliveredOrders: number; revenue: number; units: number }
  >();

  for (const row of rows) {
    const name = row.delivery_partner?.trim() || "Unknown";
    const orders = Number(row.order_count ?? 0);
    const revenue = Number(row.revenue_usd ?? 0);
    const units = Number(row.units ?? 0);
    const isDelivered = row.status?.trim() === "Delivered";

    const bucket = agg.get(name) ?? {
      orders: 0,
      deliveredOrders: 0,
      revenue: 0,
      units: 0,
    };
    bucket.orders += orders;
    bucket.revenue += revenue;
    bucket.units += units;
    if (isDelivered) bucket.deliveredOrders += orders;
    agg.set(name, bucket);
  }

  const denominator = totalOrders || 1;
  return [...agg.entries()]
    .map(([name, bucket]) => ({
      name,
      orders: bucket.orders,
      deliveredOrders: bucket.deliveredOrders,
      deliveryRatio: bucket.orders > 0 ? bucket.deliveredOrders / bucket.orders : 0,
      revenue: bucket.revenue,
      units: bucket.units,
      pct: bucket.orders / denominator,
    }))
    .sort((a, b) => b.orders - a.orders);
}

export function mapDeliveryPartnerRollupRows(
  rows: DeliveryPartnerRollupRow[],
): DeliveryPartnerByCountryData {
  const byCountryRows = new Map<string, DeliveryPartnerRollupRow[]>();
  let allOrders = 0;
  const orderCountByCountry: Record<string, number> = {};

  for (const row of rows) {
    const country = row.country?.trim() || "Unknown";
    const orders = Number(row.order_count ?? 0);
    allOrders += orders;
    orderCountByCountry[country] = (orderCountByCountry[country] ?? 0) + orders;

    const list = byCountryRows.get(country) ?? [];
    list.push(row);
    byCountryRows.set(country, list);
  }

  orderCountByCountry.All = allOrders;
  const countries = [...byCountryRows.keys()].sort((a, b) => a.localeCompare(b));
  const byCountry: Record<string, DeliveryPartnerRow[]> = {
    All: buildDeliveryPartnerRows(rows, allOrders),
  };

  for (const country of countries) {
    byCountry[country] = buildDeliveryPartnerRows(
      byCountryRows.get(country) ?? [],
      orderCountByCountry[country] ?? 0,
    );
  }

  return {
    countries: ["All", ...countries],
    byCountry,
    orderCountByCountry,
  };
}

export async function fetchDeliveryPartnerByCountry(
  filters: OrdersFilterParams,
): Promise<DeliveryPartnerByCountryData> {
  const rows = await fetchOrdersRollupRows<DeliveryPartnerRollupRow>(
    "ops_orders_delivery_partner_rollup",
    filters,
    "country, delivery_partner, status, order_count, revenue_usd, units",
  );
  return mapDeliveryPartnerRollupRows(rows);
}

export function mapRevenueLossRollupRows(rows: RevenueLossRollupRow[]): RevenueLossRow[] {
  const byTag = new Map<
    string,
    {
      orders: number;
      revenue: number;
      units: number;
      byDispatch: Map<string, { orders: number; revenue: number; units: number }>;
    }
  >();

  let revenueLossOrderCount = 0;

  for (const row of rows) {
    const tag = normalizeTag(row.tag ?? "");
    const dispatch = row.dispatch_label?.trim();
    if (!dispatch) continue;

    const orders = Number(row.order_count ?? 0);
    const revenue = Number(row.revenue_usd ?? 0);
    const units = Number(row.units ?? 0);
    revenueLossOrderCount += orders;

    if (!byTag.has(tag)) {
      byTag.set(tag, { orders: 0, revenue: 0, units: 0, byDispatch: new Map() });
    }
    const bucket = byTag.get(tag)!;
    bucket.orders += orders;
    bucket.revenue += revenue;
    bucket.units += units;

    const split = bucket.byDispatch.get(dispatch) ?? { orders: 0, revenue: 0, units: 0 };
    split.orders += orders;
    split.revenue += revenue;
    split.units += units;
    bucket.byDispatch.set(dispatch, split);
  }

  const totalOrders = revenueLossOrderCount || 1;

  const tagRows = [...byTag.entries()].map(([name, bucket]) => {
    const tagOrders = bucket.orders || 1;
    const statusSplits = [...bucket.byDispatch.entries()]
      .map(([status, split]) => ({
        status,
        orders: split.orders,
        revenue: split.revenue,
        units: split.units,
        pct: split.orders / tagOrders,
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
      orders: bucket.orders,
      revenue: bucket.revenue,
      units: bucket.units,
      pct: bucket.orders / totalOrders,
      statusSplits,
    };
  });

  const groupBuckets = new Map<
    string,
    {
      tags: typeof tagRows;
      orders: number;
      revenue: number;
      units: number;
    }
  >();

  for (const config of REVENUE_LOSS_TAG_GROUPS) {
    groupBuckets.set(config.heading, { tags: [], orders: 0, revenue: 0, units: 0 });
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
    bucket.orders += tagRow.orders;
    bucket.revenue += tagRow.revenue;
    bucket.units += tagRow.units;
  }

  const groupRows: RevenueLossRow[] = [];

  for (const config of REVENUE_LOSS_TAG_GROUPS) {
    const bucket = groupBuckets.get(config.heading)!;
    const groupOrders = bucket.orders || 1;
    const tagSplits = bucket.tags
      .flatMap((tag) =>
        tag.statusSplits.map((split) => ({
          name: revenueLossTagDispatchLabel(tag.name, split.status),
          orders: split.orders,
          revenue: split.revenue,
          units: split.units,
          pct: groupOrders > 0 ? split.orders / groupOrders : 0,
        })),
      )
      .sort((a, b) => b.revenue - a.revenue);

    groupRows.push({
      name: config.heading,
      kind: "group",
      orders: bucket.orders,
      revenue: bucket.revenue,
      units: bucket.units,
      pct: bucket.orders / totalOrders,
      tagSplits,
    });
  }

  const singleTagRows: RevenueLossRow[] = ungrouped.map((tag) => ({
    name: tag.name,
    kind: "tag",
    orders: tag.orders,
    revenue: tag.revenue,
    units: tag.units,
    pct: tag.pct,
    statusSplits: tag.statusSplits.map((split) => ({
      ...split,
      status: revenueLossTagDispatchLabel(tag.name, split.status),
    })),
  }));

  return [...groupRows, ...singleTagRows.sort((a, b) => b.revenue - a.revenue).slice(0, 10)];
}

export async function fetchRevenueLossBreakdown(
  filters: OrdersFilterParams,
): Promise<RevenueLossRow[]> {
  const rows = await fetchOrdersRollupRows<RevenueLossRollupRow>(
    "ops_orders_revenue_loss_rollup",
    filters,
    "tag, dispatch_label, order_count, revenue_usd, units",
  );
  return mapRevenueLossRollupRows(rows);
}

type CountrySlaTotals = {
  confirmDaysSum: number;
  confirmCount: number;
  deliverDaysSum: number;
  deliverCount: number;
  returnDaysSum: number;
  returnCount: number;
  shipDaysSum: number;
  shipCount: number;
  shippedWithin48h: number;
};

function emptyCountrySlaTotals(): CountrySlaTotals {
  return {
    confirmDaysSum: 0,
    confirmCount: 0,
    deliverDaysSum: 0,
    deliverCount: 0,
    returnDaysSum: 0,
    returnCount: 0,
    shipDaysSum: 0,
    shipCount: 0,
    shippedWithin48h: 0,
  };
}

function avgFromTotals(sum: number, count: number): number | null {
  return count > 0 ? sum / count : null;
}

function countrySlaRowsFromTotals(
  buckets: Map<string, CountrySlaTotals>,
  metric: FulfillmentSlaMetric,
) {
  const rows = [];

  for (const [country, bucket] of buckets) {
    if (metric === "confirm" && bucket.confirmCount > 0) {
      rows.push({
        country,
        value: avgFromTotals(bucket.confirmDaysSum, bucket.confirmCount),
        sampleCount: bucket.confirmCount,
      });
    } else if (metric === "ship" && bucket.shipCount > 0) {
      rows.push({
        country,
        value: avgFromTotals(bucket.shipDaysSum, bucket.shipCount),
        sampleCount: bucket.shipCount,
      });
    } else if (metric === "deliver" && bucket.deliverCount > 0) {
      rows.push({
        country,
        value: avgFromTotals(bucket.deliverDaysSum, bucket.deliverCount),
        sampleCount: bucket.deliverCount,
      });
    } else if (metric === "return" && bucket.returnCount > 0) {
      rows.push({
        country,
        value: avgFromTotals(bucket.returnDaysSum, bucket.returnCount),
        sampleCount: bucket.returnCount,
      });
    } else if (metric === "shipped48h" && bucket.shipCount > 0) {
      rows.push({
        country,
        value: bucket.shippedWithin48h / bucket.shipCount,
        sampleCount: bucket.shipCount,
      });
    }
  }

  return rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}

export function mapSlaRollupRows(
  rows: SlaRollupRow[],
  sampleSize: number,
): FulfillmentSLA {
  const totals = emptyCountrySlaTotals();
  const byCountry = new Map<string, CountrySlaTotals>();

  for (const row of rows) {
    const country = row.country?.trim() || "Unknown";
    const countryBucket = byCountry.get(country) ?? emptyCountrySlaTotals();

    const confirmCount = Number(row.confirm_count ?? 0);
    const deliverCount = Number(row.deliver_count ?? 0);
    const returnCount = Number(row.return_count ?? 0);
    const shipCount = Number(row.ship_count ?? 0);

    totals.confirmDaysSum += Number(row.confirm_days_sum ?? 0);
    totals.confirmCount += confirmCount;
    totals.deliverDaysSum += Number(row.deliver_days_sum ?? 0);
    totals.deliverCount += deliverCount;
    totals.returnDaysSum += Number(row.return_days_sum ?? 0);
    totals.returnCount += returnCount;
    totals.shipDaysSum += Number(row.ship_days_sum ?? 0);
    totals.shipCount += shipCount;
    totals.shippedWithin48h += Number(row.shipped_within_48h_count ?? 0);

    countryBucket.confirmDaysSum += Number(row.confirm_days_sum ?? 0);
    countryBucket.confirmCount += confirmCount;
    countryBucket.deliverDaysSum += Number(row.deliver_days_sum ?? 0);
    countryBucket.deliverCount += deliverCount;
    countryBucket.returnDaysSum += Number(row.return_days_sum ?? 0);
    countryBucket.returnCount += returnCount;
    countryBucket.shipDaysSum += Number(row.ship_days_sum ?? 0);
    countryBucket.shipCount += shipCount;
    countryBucket.shippedWithin48h += Number(row.shipped_within_48h_count ?? 0);
    byCountry.set(country, countryBucket);
  }

  return {
    avgOrderToConfirmDays: avgFromTotals(totals.confirmDaysSum, totals.confirmCount),
    avgOrderToDeliverDays: avgFromTotals(totals.deliverDaysSum, totals.deliverCount),
    avgOrderToReturnDays: avgFromTotals(totals.returnDaysSum, totals.returnCount),
    avgOrderToShipDays: avgFromTotals(totals.shipDaysSum, totals.shipCount),
    shippedWithin48hPct: totals.shipCount ? totals.shippedWithin48h / totals.shipCount : 0,
    sampleSize,
    byCountry: {
      confirm: countrySlaRowsFromTotals(byCountry, "confirm"),
      ship: countrySlaRowsFromTotals(byCountry, "ship"),
      deliver: countrySlaRowsFromTotals(byCountry, "deliver"),
      return: countrySlaRowsFromTotals(byCountry, "return"),
      shipped48h: countrySlaRowsFromTotals(byCountry, "shipped48h"),
    },
  };
}

export async function fetchFulfillmentSla(
  filters: OrdersFilterParams,
  sampleSize: number,
): Promise<FulfillmentSLA> {
  const rows = await fetchOrdersRollupRows<SlaRollupRow>(
    "ops_orders_sla_rollup",
    filters,
    "country, confirm_days_sum, confirm_count, deliver_days_sum, deliver_count, return_days_sum, return_count, ship_days_sum, ship_count, shipped_within_48h_count",
  );
  return mapSlaRollupRows(rows, sampleSize);
}
