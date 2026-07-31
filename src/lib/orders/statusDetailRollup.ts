import type { OperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
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

function mergeCountryTagGroups(
  groups: Array<{
    country: string;
    orders: number;
    tags: Array<{ tag: string; orders: number; pct: number; orderIds: number[] }>;
  }>,
) {
  const merged = new Map<
    string,
    { orders: number; tags: Map<string, { orders: number; orderIds: Set<number> }> }
  >();

  for (const group of groups) {
    const country = normalizeOrderCountry(group.country);
    const bucket = merged.get(country) ?? { orders: 0, tags: new Map() };
    bucket.orders += group.orders;

    for (const tagRow of group.tags) {
      const tagBucket = bucket.tags.get(tagRow.tag) ?? { orders: 0, orderIds: new Set<number>() };
      tagBucket.orders += tagRow.orders;
      for (const id of tagRow.orderIds) tagBucket.orderIds.add(id);
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
        };
      }),
    }))
    .sort((a, b) => b.orders - a.orders || a.country.localeCompare(b.country));
}

export function mapStatusDetailFromRpc(
  payload: Record<string, unknown> | null,
  groupId: OperationsStatusGroupId,
): OperationsStatusOrderDetail {
  const group = getOperationsStatusGroup(groupId);
  if (!group) {
    throw new Error(`Unknown group: ${groupId}`);
  }

  const base = {
    groupId,
    title: String(payload?.title ?? group.title),
    groupBy: (payload?.groupBy === "title" ? "title" : "tag") as "tag" | "title",
    daysFrom: (
      ["confirmationDate", "approvedDate", "shipmentDateLog", "undeliveredDate"].includes(
        String(payload?.daysFrom ?? ""),
      )
        ? payload!.daysFrom
        : "orderDate"
    ) as import("@/lib/operations/status-kpi-groups").OperationsDaysFrom,
    totalOrders: Number(payload?.totalOrders ?? 0),
    filteredTotalOrders: Number(payload?.filteredTotalOrders ?? 0),
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
    dayBuckets,
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
