import type {
  OperationsStatusCountrySummary,
  OperationsStatusOrderDetail,
  OperationsStatusOrderUserGroup,
} from "@/lib/analytics/operations-status-detail";
import type {
  OperationsStatusDaysGroup,
  OperationsStatusCountryGroup,
} from "@/lib/analytics/operations-status-detail";
import { normalizeOrderCountry } from "@/lib/country-normalization";
import {
  getOperationsStatusGroup,
  type OperationsStatusGroupId,
} from "@/lib/operations/status-kpi-groups";
import { getOpsDb } from "@/lib/operations/opsDb";
import {
  type OrdersFilterParams,
  toRpcFilterParams,
} from "@/lib/orders/filteredItems";

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
}

function mapOrderGroups(value: unknown): OperationsStatusOrderUserGroup[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const user = row as Record<string, unknown>;
    const skus = Array.isArray(user.skus)
      ? user.skus.map((skuRow) => {
          const sku = skuRow as Record<string, unknown>;
          return {
            sku: String(sku.sku ?? "No SKU"),
            bifurcation: sku.bifurcation == null ? undefined : String(sku.bifurcation),
            orderIds: asNumberArray(sku.orderIds),
          };
        })
      : [];
    const userIdRaw = user.userId;
    return {
      userId:
        userIdRaw == null || userIdRaw === ""
          ? null
          : Number.isFinite(Number(userIdRaw))
            ? Number(userIdRaw)
            : null,
      skus,
    };
  });
}

function mergeOrderGroups(
  groups: OperationsStatusOrderUserGroup[],
): OperationsStatusOrderUserGroup[] {
  const userMap = new Map<
    string,
    Map<string, { sku: string; bifurcation?: string; orderIds: Set<number> }>
  >();

  for (const group of groups) {
    const userKey = group.userId == null ? "null" : String(group.userId);
    if (!userMap.has(userKey)) userMap.set(userKey, new Map());
    const skuMap = userMap.get(userKey)!;

    for (const skuGroup of group.skus) {
      const skuKey = `${skuGroup.sku}\0${skuGroup.bifurcation ?? ""}`;
      const entry =
        skuMap.get(skuKey) ??
        { sku: skuGroup.sku, bifurcation: skuGroup.bifurcation, orderIds: new Set<number>() };
      for (const id of skuGroup.orderIds) entry.orderIds.add(id);
      skuMap.set(skuKey, entry);
    }
  }

  return [...userMap.entries()]
    .map(([userKey, skuMap]) => ({
      userId: userKey === "null" ? null : Number(userKey),
      skus: [...skuMap.values()]
        .map(({ sku, bifurcation, orderIds }) => ({
          sku,
          bifurcation,
          orderIds: [...orderIds].sort((a, b) => a - b),
        }))
        .sort(
          (a, b) =>
            b.orderIds.length - a.orderIds.length || a.sku.localeCompare(b.sku),
        ),
    }))
    .sort((a, b) => {
      const aCount = a.skus.reduce((sum, s) => sum + s.orderIds.length, 0);
      const bCount = b.skus.reduce((sum, s) => sum + s.orderIds.length, 0);
      return bCount - aCount || (a.userId ?? 0) - (b.userId ?? 0);
    });
}

function mergeCountrySummaries(
  summaries: OperationsStatusCountrySummary[],
): OperationsStatusCountrySummary[] {
  const merged = new Map<
    string,
    { orders: number; bifurcations: Map<string, number> }
  >();

  for (const row of summaries) {
    const country = normalizeOrderCountry(row.country);
    const bucket = merged.get(country) ?? { orders: 0, bifurcations: new Map() };
    bucket.orders += row.orders;
    for (const b of row.bifurcations) {
      const key = b.bifurcation || "Unknown";
      bucket.bifurcations.set(key, (bucket.bifurcations.get(key) ?? 0) + b.orders);
    }
    merged.set(country, bucket);
  }

  return [...merged.entries()]
    .map(([country, bucket]) => ({
      country,
      orders: bucket.orders,
      bifurcations: [...bucket.bifurcations.entries()]
        .map(([bifurcation, orders]) => ({ bifurcation, orders }))
        .sort((a, b) => b.orders - a.orders || a.bifurcation.localeCompare(b.bifurcation)),
    }))
    .sort((a, b) => b.orders - a.orders || a.country.localeCompare(b.country));
}

function mapCountrySummaries(payload: unknown): OperationsStatusCountrySummary[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((row) => {
    const countryRow = row as Record<string, unknown>;
    const bifurcations = Array.isArray(countryRow.bifurcations)
      ? countryRow.bifurcations.map((bRow) => {
          const b = bRow as Record<string, unknown>;
          return {
            bifurcation: String(b.bifurcation ?? "Unknown"),
            orders: Number(b.orders ?? 0),
          };
        })
      : [];
    return {
      country: String(countryRow.country ?? "Unknown"),
      orders: Number(countryRow.orders ?? 0),
      bifurcations,
    };
  });
}

function mergeCountryTagGroups(
  groups: Array<{
    country: string;
    orders: number;
    tags: Array<{
      tag: string;
      orders: number;
      pct: number;
      orderIds: number[];
      orderGroups?: OperationsStatusOrderUserGroup[];
    }>;
  }>,
) {
  const merged = new Map<
    string,
    {
      orders: number;
      tags: Map<
        string,
        { orders: number; orderIds: Set<number>; orderGroups: OperationsStatusOrderUserGroup[] }
      >;
    }
  >();

  for (const group of groups) {
    const country = normalizeOrderCountry(group.country);
    const bucket = merged.get(country) ?? { orders: 0, tags: new Map() };
    bucket.orders += group.orders;

    for (const tagRow of group.tags) {
      const tagBucket = bucket.tags.get(tagRow.tag) ?? {
        orders: 0,
        orderIds: new Set<number>(),
        orderGroups: [] as OperationsStatusOrderUserGroup[],
      };
      tagBucket.orders += tagRow.orders;
      for (const id of tagRow.orderIds) tagBucket.orderIds.add(id);
      if (tagRow.orderGroups?.length) {
        tagBucket.orderGroups.push(...tagRow.orderGroups);
      }
      bucket.tags.set(tagRow.tag, tagBucket);
    }

    merged.set(country, bucket);
  }

  return [...merged.entries()]
    .map(([country, bucket]) => ({
      country,
      orders: bucket.orders,
      tags: [...bucket.tags.entries()].map(([tag, tagBucket]) => {
        const orderIds = [...tagBucket.orderIds].sort((a, b) => a - b);
        return {
          tag,
          orders: orderIds.length,
          pct: bucket.orders > 0 ? orderIds.length / bucket.orders : 0,
          orderIds,
          orderGroups: mergeOrderGroups(tagBucket.orderGroups),
        };
      }),
    }))
    .sort((a, b) => b.orders - a.orders || a.country.localeCompare(b.country));
}

function mergeDayBuckets(dayBuckets: OperationsStatusDaysGroup[]): OperationsStatusDaysGroup[] {
  return dayBuckets.map((bucket) => {
    const countryMap = new Map<
      string,
      {
        country: string;
        orders: number;
        subgroups: Map<
          string,
          {
            orders: number;
            orderIds: Set<number>;
            orderGroups: OperationsStatusOrderUserGroup[];
          }
        >;
      }
    >();

    for (const countryGroup of bucket.countries) {
      const country = normalizeOrderCountry(countryGroup.country);
      const entry =
        countryMap.get(country) ??
        { country, orders: 0, subgroups: new Map() };
      entry.orders += countryGroup.orders;

      for (const subgroup of countryGroup.subgroups) {
        const subgroupEntry =
          entry.subgroups.get(subgroup.label) ??
          { orders: 0, orderIds: new Set<number>(), orderGroups: [] };
        subgroupEntry.orders += subgroup.orders;
        for (const id of subgroup.orderIds) subgroupEntry.orderIds.add(id);
        if (subgroup.orderGroups?.length) {
          subgroupEntry.orderGroups.push(...subgroup.orderGroups);
        }
        entry.subgroups.set(subgroup.label, subgroupEntry);
      }

      countryMap.set(country, entry);
    }

    const countries: OperationsStatusCountryGroup[] = [...countryMap.values()]
      .map(({ country, orders, subgroups }) => ({
        country,
        orders,
        subgroups: [...subgroups.entries()]
          .map(([label, { orders: subgroupOrders, orderIds, orderGroups }]) => ({
            label,
            orders: subgroupOrders,
            orderIds: [...orderIds].sort((a, b) => a - b),
            orderGroups: mergeOrderGroups(orderGroups),
          }))
          .sort((a, b) => b.orders - a.orders || a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => b.orders - a.orders || a.country.localeCompare(b.country));

    return {
      ...bucket,
      countries,
    };
  });
}

export function mapStatusDetailFromRpc(
  payload: Record<string, unknown> | null,
  groupId: OperationsStatusGroupId,
): OperationsStatusOrderDetail {
  const group = getOperationsStatusGroup(groupId);
  if (!group) {
    throw new Error(`Unknown group: ${groupId}`);
  }

  const countrySummaries = mergeCountrySummaries(mapCountrySummaries(payload?.countrySummaries));

  const base = {
    groupId,
    title: String(payload?.title ?? group.title),
    groupBy: (payload?.groupBy === "title" ? "title" : "tag") as "tag" | "title",
    daysFrom: (
      [
        "confirmationDate",
        "approvedDate",
        "shipmentDateLog",
        "undeliveredDate",
        "finalActionDateUndelivered",
      ].includes(
        String(payload?.daysFrom ?? ""),
      )
        ? payload!.daysFrom
        : "orderDate"
    ) as import("@/lib/operations/status-kpi-groups").OperationsDaysFrom,
    totalOrders: Number(payload?.totalOrders ?? 0),
    filteredTotalOrders: Number(payload?.filteredTotalOrders ?? 0),
    countrySummaries,
  };

  if (payload?.layout === "countryTag") {
    const countryGroups = Array.isArray(payload.countryGroups)
      ? payload.countryGroups.map((row) => {
          const countryRow = row as Record<string, unknown>;
          const tags = Array.isArray(countryRow.tags)
            ? countryRow.tags.map((tagRow) => {
                const tag = tagRow as Record<string, unknown>;
                return {
                  tag: String(tag.tag ?? ""),
                  orders: Number(tag.orders ?? 0),
                  pct: Number(tag.pct ?? 0),
                  orderIds: asNumberArray(tag.orderIds),
                  orderGroups: mapOrderGroups(tag.orderGroups),
                };
              })
            : [];
          return {
            country: String(countryRow.country ?? "Unknown"),
            orders: Number(countryRow.orders ?? 0),
            tags,
          };
        })
      : [];

    return {
      ...base,
      layout: "countryTag",
      countryGroups: mergeCountryTagGroups(countryGroups),
    };
  }

  const dayBuckets = Array.isArray(payload?.dayBuckets)
    ? payload.dayBuckets.map((row) => {
        const dayRow = row as Record<string, unknown>;
        const daysRaw = dayRow.days;
        const days =
          daysRaw === null || daysRaw === undefined
            ? null
            : Number.isFinite(Number(daysRaw))
              ? Number(daysRaw)
              : null;
        const countries = Array.isArray(dayRow.countries)
          ? dayRow.countries.map((countryRow) => {
              const country = countryRow as Record<string, unknown>;
              const subgroups = Array.isArray(country.subgroups)
                ? country.subgroups.map((subgroup) => {
                    const sg = subgroup as Record<string, unknown>;
                    return {
                      label: String(sg.label ?? ""),
                      orders: Number(sg.orders ?? 0),
                      orderIds: asNumberArray(sg.orderIds),
                      orderGroups: mapOrderGroups(sg.orderGroups),
                    };
                  })
                : [];
              return {
                country: String(country.country ?? "Unknown"),
                orders: Number(country.orders ?? 0),
                subgroups,
              };
            })
          : [];
        return {
          days,
          label: String(dayRow.label ?? ""),
          orders: Number(dayRow.orders ?? 0),
          countries,
        };
      })
    : [];

  return {
    ...base,
    layout: "daysCountrySubgroup",
    dayBuckets: mergeDayBuckets(dayBuckets),
  };
}

export async function fetchOperationsStatusDetail(
  filters: OrdersFilterParams,
  groupId: OperationsStatusGroupId,
): Promise<OperationsStatusOrderDetail> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_orders_status_detail", {
    p_group_id: groupId,
    ...toRpcFilterParams(filters),
  });

  if (error) {
    throw new Error(`get_ops_orders_status_detail failed: ${error.message}`);
  }

  return mapStatusDetailFromRpc(
    (data ?? null) as Record<string, unknown> | null,
    groupId,
  );
}
