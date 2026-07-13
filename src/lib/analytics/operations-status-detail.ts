import { differenceInDays, startOfDay } from "date-fns";
import {
  groupByOrder,
  orderStatusFromLines,
  orderCountryFromLines,
  orderRepresentativeLine,
  type OrderGroupMap,
} from "@/lib/analytics/orders";
import {
  OPERATIONS_STATUS_KPI_GROUPS,
  type OperationsDaysFrom,
  type OperationsStatusDetailLayout,
  type OperationsStatusGroupBy,
  type OperationsStatusGroupId,
  type OperationsStatusKpiGroup,
} from "@/lib/operations/status-kpi-groups";
import type { OrderLineItem } from "@/lib/types/order";

export interface OperationsStatusSubgroup {
  label: string;
  orders: number;
  orderIds: number[];
}

export interface OperationsStatusCountryGroup {
  country: string;
  orders: number;
  subgroups: OperationsStatusSubgroup[];
}

export interface OperationsStatusDaysGroup {
  days: number | null;
  label: string;
  orders: number;
  countries: OperationsStatusCountryGroup[];
}

export interface OperationsStatusCountryTagSubgroup {
  tag: string;
  orders: number;
  /** Share of this country's return orders (not date-range total). */
  pct: number;
  orderIds: number[];
}

export interface OperationsStatusCountryTagGroup {
  country: string;
  orders: number;
  tags: OperationsStatusCountryTagSubgroup[];
}

type OperationsStatusOrderDetailBase = {
  groupId: OperationsStatusGroupId;
  title: string;
  groupBy: OperationsStatusGroupBy;
  daysFrom: OperationsDaysFrom;
  /** Orders matching this status card. */
  totalOrders: number;
  /** All orders in the date/filter selection (denominator for %). */
  filteredTotalOrders: number;
};

export type OperationsStatusOrderDetail =
  | (OperationsStatusOrderDetailBase & {
      layout: "daysCountrySubgroup";
      dayBuckets: OperationsStatusDaysGroup[];
    })
  | (OperationsStatusOrderDetailBase & {
      layout: "countryTag";
      countryGroups: OperationsStatusCountryTagGroup[];
    });

function normalizeCountry(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "Unknown";
}

function normalizeTag(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No tag";
}

function normalizeTitle(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No title";
}

function daysLabel(days: number | null): string {
  if (days === null) return "No date";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function referenceDate(
  line: OrderLineItem,
  daysFrom: OperationsDaysFrom,
): Date | null {
  if (daysFrom === "orderDate") return line.orderDate;
  return line.shipmentDateLog;
}

function daysSinceReference(
  line: OrderLineItem,
  daysFrom: OperationsDaysFrom,
  today: Date,
): number | null {
  const ref = referenceDate(line, daysFrom);
  if (!ref || Number.isNaN(ref.getTime())) return null;
  return Math.max(
    0,
    differenceInDays(startOfDay(today), startOfDay(ref)),
  );
}

function sortByDaysDesc(
  a: { days: number | null },
  b: { days: number | null },
): number {
  if (a.days === null && b.days === null) return 0;
  if (a.days === null) return 1;
  if (b.days === null) return -1;
  return b.days - a.days;
}

function sortDaysGroups(
  groups: OperationsStatusDaysGroup[],
): OperationsStatusDaysGroup[] {
  return [...groups].sort(sortByDaysDesc);
}

function sortCountries(
  countries: OperationsStatusCountryGroup[],
): OperationsStatusCountryGroup[] {
  return [...countries].sort((a, b) => {
    const o = b.orders - a.orders;
    return o !== 0 ? o : a.country.localeCompare(b.country);
  });
}

function sortCountryTagGroups(
  groups: OperationsStatusCountryTagGroup[],
): OperationsStatusCountryTagGroup[] {
  return [...groups].sort((a, b) => {
    const o = b.orders - a.orders;
    return o !== 0 ? o : a.country.localeCompare(b.country);
  });
}

function sortCountryTagSubgroups(
  tags: OperationsStatusCountryTagSubgroup[],
): OperationsStatusCountryTagSubgroup[] {
  return [...tags].sort((a, b) => {
    const o = b.orders - a.orders;
    return o !== 0 ? o : a.tag.localeCompare(b.tag);
  });
}

function sortSubgroups(
  subgroups: OperationsStatusSubgroup[],
): OperationsStatusSubgroup[] {
  return [...subgroups].sort((a, b) => {
    const o = b.orders - a.orders;
    return o !== 0 ? o : a.label.localeCompare(b.label);
  });
}

function uniqueOrderCount(sets: Iterable<Set<number>>): number {
  const ids = new Set<number>();
  for (const set of sets) {
    for (const id of set) ids.add(id);
  }
  return ids.size;
}

function countMatchingOrders(
  byOrder: OrderGroupMap,
  statusSet: Set<string>,
): number {
  let totalOrders = 0;
  for (const [, lines] of byOrder) {
    if (statusSet.has(orderStatusFromLines(lines))) totalOrders++;
  }
  return totalOrders;
}

export interface OperationsStatusCounts {
  /** All unique orders in the current date/filter selection. */
  totalOrders: number;
  /** Unique orders with status = Delivered. */
  deliveredOrders: number;
  byGroup: Record<OperationsStatusGroupId, number>;
}

export function computeOperationsStatusCounts(
  items: OrderLineItem[],
): OperationsStatusCounts {
  const byOrder = groupByOrder(items);
  const byGroup = Object.fromEntries(
    OPERATIONS_STATUS_KPI_GROUPS.map((g) => [g.id, 0]),
  ) as Record<OperationsStatusGroupId, number>;

  let deliveredOrders = 0;

  for (const group of OPERATIONS_STATUS_KPI_GROUPS) {
    const statusSet = new Set(group.statuses);
    let n = 0;
    for (const [, lines] of byOrder) {
      if (statusSet.has(orderStatusFromLines(lines))) n++;
    }
    byGroup[group.id] = n;
  }

  for (const [, lines] of byOrder) {
    if (orderStatusFromLines(lines) === "Delivered") deliveredOrders++;
  }

  return {
    totalOrders: byOrder.size,
    deliveredOrders,
    byGroup,
  };
}

function computeCountryTagDetail(
  byOrder: OrderGroupMap,
  group: OperationsStatusKpiGroup,
  totalOrders: number,
  filteredTotalOrders: number,
): OperationsStatusOrderDetail {
  const statusSet = new Set(group.statuses);
  const tree = new Map<string, Map<string, Set<number>>>();

  for (const [, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    if (!line) continue;
    const status = orderStatusFromLines(lines);
    if (!statusSet.has(status)) continue;

    const tag = normalizeTag(line.tag);
    const country = normalizeCountry(orderCountryFromLines(lines));

    if (!tree.has(country)) tree.set(country, new Map());
    const tagMap = tree.get(country)!;
    if (!tagMap.has(tag)) tagMap.set(tag, new Set());
    tagMap.get(tag)!.add(line.metabaseId);
  }

  const countryGroups: OperationsStatusCountryTagGroup[] = [
    ...tree.entries(),
  ].map(([country, tagMap]) => {
    const countryOrders = uniqueOrderCount(tagMap.values());
    const pctOfCountry = (orders: number) =>
      countryOrders > 0 ? orders / countryOrders : 0;

    const tags: OperationsStatusCountryTagSubgroup[] = [...tagMap.entries()].map(
      ([tag, orderIds]) => {
        const ids = [...orderIds].sort((a, b) => a - b);
        return {
          tag,
          orders: ids.length,
          pct: pctOfCountry(ids.length),
          orderIds: ids,
        };
      },
    );

    return {
      country,
      orders: countryOrders,
      tags: sortCountryTagSubgroups(tags),
    };
  });

  return {
    groupId: group.id,
    title: group.title,
    groupBy: group.groupBy,
    daysFrom: group.daysFrom,
    totalOrders,
    filteredTotalOrders,
    layout: "countryTag",
    countryGroups: sortCountryTagGroups(countryGroups),
  };
}

function computeDaysCountrySubgroupDetail(
  byOrder: OrderGroupMap,
  group: OperationsStatusKpiGroup,
  totalOrders: number,
  filteredTotalOrders: number,
  today: Date,
): OperationsStatusOrderDetail {
  const statusSet = new Set(group.statuses);
  const tree = new Map<string, Map<string, Map<string, Set<number>>>>();

  const subgroupLabel = (line: OrderLineItem) =>
    group.groupBy === "tag"
      ? normalizeTag(line.tag)
      : normalizeTitle(line.title);

  for (const [, lines] of byOrder) {
    const line = orderRepresentativeLine(lines);
    if (!line) continue;
    const status = orderStatusFromLines(lines);
    if (!statusSet.has(status)) continue;

    const country = normalizeCountry(orderCountryFromLines(lines));
    const label = subgroupLabel(line);
    const days = daysSinceReference(line, group.daysFrom, today);
    const daysKey = days === null ? "null" : String(days);

    if (!tree.has(daysKey)) tree.set(daysKey, new Map());
    const countryMap = tree.get(daysKey)!;
    if (!countryMap.has(country)) countryMap.set(country, new Map());
    const labelMap = countryMap.get(country)!;
    if (!labelMap.has(label)) labelMap.set(label, new Set());
    labelMap.get(label)!.add(line.metabaseId);
  }

  const dayBuckets: OperationsStatusDaysGroup[] = [...tree.entries()].map(
    ([daysKey, countryMap]) => {
      const days =
        daysKey === "null" ? null : Number.parseInt(daysKey, 10);
      const parsedDays = Number.isFinite(days) ? days : null;

      const countries: OperationsStatusCountryGroup[] = [
        ...countryMap.entries(),
      ].map(([country, labelMap]) => {
        const subgroups: OperationsStatusSubgroup[] = [...labelMap.entries()]
          .map(([label, orderIds]) => {
            const ids = [...orderIds].sort((a, b) => a - b);
            return {
              label,
              orders: ids.length,
              orderIds: ids,
            };
          });

        return {
          country,
          orders: uniqueOrderCount(labelMap.values()),
          subgroups: sortSubgroups(subgroups),
        };
      });

      return {
        days: parsedDays,
        label: daysLabel(parsedDays),
        orders: uniqueOrderCount(
          [...countryMap.values()].flatMap((labelMap) => [...labelMap.values()]),
        ),
        countries: sortCountries(countries),
      };
    },
  );

  return {
    groupId: group.id,
    title: group.title,
    groupBy: group.groupBy,
    daysFrom: group.daysFrom,
    totalOrders,
    filteredTotalOrders,
    layout: "daysCountrySubgroup",
    dayBuckets: sortDaysGroups(dayBuckets),
  };
}

export function computeOperationsStatusOrderDetail(
  items: OrderLineItem[],
  group: OperationsStatusKpiGroup,
  today: Date = new Date(),
): OperationsStatusOrderDetail {
  const byOrder = groupByOrder(items);
  const statusSet = new Set(group.statuses);
  const totalOrders = countMatchingOrders(byOrder, statusSet);
  const filteredTotalOrders = byOrder.size;

  const layout: OperationsStatusDetailLayout = group.detailLayout;

  if (layout === "countryTag") {
    return computeCountryTagDetail(
      byOrder,
      group,
      totalOrders,
      filteredTotalOrders,
    );
  }

  return computeDaysCountrySubgroupDetail(
    byOrder,
    group,
    totalOrders,
    filteredTotalOrders,
    today,
  );
}
