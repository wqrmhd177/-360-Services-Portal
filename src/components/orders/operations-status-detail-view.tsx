"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
import type {
  OperationsStatusDaysGroup,
  OperationsStatusCountrySummary,
  OperationsStatusCountryTagSubgroup,
  OperationsStatusOrderUserGroup,
} from "@/lib/analytics/operations-status-detail";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function pctOfTotal(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

export type CountryBifurcationSelection = {
  country: string;
  bifurcation: string | null;
};

function filterOrderGroups(
  groups: OperationsStatusOrderUserGroup[] | undefined,
  bifurcation: string | null,
): OperationsStatusOrderUserGroup[] {
  if (!groups?.length) return [];
  if (!bifurcation) return groups;

  return groups
    .map((user) => ({
      ...user,
      skus: user.skus.filter((s) => (s.bifurcation ?? "Unknown") === bifurcation),
    }))
    .filter((user) => user.skus.length > 0);
}

function countOrdersInGroups(groups: OperationsStatusOrderUserGroup[]): number {
  const ids = new Set<number>();
  for (const user of groups) {
    for (const sku of user.skus) {
      for (const id of sku.orderIds) ids.add(id);
    }
  }
  return ids.size;
}

// ── grouped order list ────────────────────────────────────────────────────────

function OrderGroupList({ orderGroups }: { orderGroups: OperationsStatusOrderUserGroup[] }) {
  if (orderGroups.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-[var(--muted)]">No orders.</p>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {orderGroups.map((user) => {
        const userKey = user.userId ?? "unknown";
        const totalOrders = user.skus.reduce((sum, s) => sum + s.orderIds.length, 0);
        return (
          <div
            key={userKey}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2"
          >
            <p className="text-xs font-semibold text-[var(--foreground)]">
              User ID{" "}
              <span className="font-mono tabular-nums">
                {user.userId ?? "—"}
              </span>
              <span className="ml-2 font-normal text-[var(--muted)]">
                ({formatNumber(totalOrders)} order{totalOrders === 1 ? "" : "s"})
              </span>
            </p>
            <div className="mt-2 space-y-2">
              {user.skus.map((skuGroup) => (
                <div key={`${userKey}-${skuGroup.sku}-${skuGroup.bifurcation ?? ""}`}>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {skuGroup.sku}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {skuGroup.orderIds.map((id) => (
                      <li
                        key={id}
                        className="rounded-md border border-[var(--card-border)] bg-[var(--table-header)]/50 px-2 py-0.5 font-mono text-xs tabular-nums text-[var(--foreground)]"
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── expandable reason row ─────────────────────────────────────────────────────

function ReasonRow({
  label,
  orders,
  dateLabel,
  showDate,
  orderGroups,
}: {
  label: string;
  orders: number;
  dateLabel?: string;
  showDate: boolean;
  orderGroups: OperationsStatusOrderUserGroup[];
}) {
  const [open, setOpen] = useState(false);
  const displayCount = orderGroups.length > 0 ? countOrdersInGroups(orderGroups) : orders;

  return (
    <div className="border-b border-[var(--card-border)] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--table-header)]/60 transition-colors"
      >
        {showDate && (
          <span className="w-20 shrink-0 text-xs font-medium text-[var(--muted)] tabular-nums">
            {dateLabel ?? "—"}
          </span>
        )}
        <span className="min-w-0 flex-1 break-words text-sm text-[var(--foreground)]">
          {label}
        </span>
        <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
          {formatNumber(displayCount)}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
        )}
      </button>
      {open && (
        <div className="bg-[var(--table-header)]/40 px-4 pb-2">
          <OrderGroupList orderGroups={orderGroups} />
        </div>
      )}
    </div>
  );
}

// ── country + bifurcation sidebar ─────────────────────────────────────────────

function CountryBifurcationSidebar({
  countries,
  countrySummaries,
  selected,
  onSelect,
}: {
  countries: Array<{ country: string; orders: number }>;
  countrySummaries: OperationsStatusCountrySummary[];
  selected: CountryBifurcationSelection;
  onSelect: (next: CountryBifurcationSelection) => void;
}) {
  const summaryByCountry = new Map(countrySummaries.map((s) => [s.country, s]));

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-[var(--card-border)] overflow-y-auto sm:w-72">
      {countries.map(({ country, orders }) => {
        const isAll = country === "All";
        const isCountryExpanded = !isAll && selected.country === country;
        const isCountryActive = isCountryExpanded && selected.bifurcation === null;
        const summary = summaryByCountry.get(country);
        const bifurcations = isCountryExpanded ? (summary?.bifurcations ?? []) : [];

        return (
          <div key={country} className="border-b border-[var(--card-border)] last:border-0">
            <button
              type="button"
              onClick={() => onSelect({ country, bifurcation: null })}
              className={cn(
                "flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors",
                isCountryActive
                  ? "bg-teal-600 text-white font-semibold"
                  : "text-[var(--foreground)] hover:bg-[var(--table-header)]",
              )}
            >
              <span className="min-w-0 flex-1 break-words leading-snug">{country}</span>
              <span
                className={cn(
                  "shrink-0 tabular-nums font-medium",
                  isCountryActive ? "text-white/90" : "text-[var(--muted)]",
                )}
              >
                {formatNumber(orders)}
              </span>
            </button>

            {bifurcations.map(({ bifurcation, orders: bifOrders }) => {
              const isBifActive =
                selected.country === country && selected.bifurcation === bifurcation;
              return (
                <button
                  key={`${country}-${bifurcation}`}
                  type="button"
                  onClick={() => onSelect({ country, bifurcation })}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 py-2 pl-5 pr-3 text-left text-[11px] transition-colors",
                    isBifActive
                      ? "bg-teal-600/90 text-white font-medium"
                      : "text-[var(--muted)] hover:bg-[var(--table-header)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="min-w-0 flex-1 break-words leading-snug before:mr-1 before:content-['–']">
                    {bifurcation}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatNumber(bifOrders)}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── right-panel header row ────────────────────────────────────────────────────

function RightPanelHeader({ showDate, subgroupLabel }: { showDate: boolean; subgroupLabel: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--card-border)] bg-[var(--table-header)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
      {showDate && <span className="w-20 shrink-0">Date</span>}
      <span className="min-w-0 flex-1">{subgroupLabel}</span>
      <span className="ml-2 shrink-0">Count</span>
      <span className="w-4 shrink-0" />
    </div>
  );
}

// ── data inversion: dayBuckets → countryFirst ────────────────────────────────

type ReasonEntry = {
  label: string;
  orders: number;
  orderGroups: OperationsStatusOrderUserGroup[];
};
type DateEntry = { days: number | null; label: string; orders: number; reasons: ReasonEntry[] };
type CountryEntry = { country: string; orders: number; dates: DateEntry[] };

function mergeUserGroups(
  a: OperationsStatusOrderUserGroup[],
  b: OperationsStatusOrderUserGroup[],
): OperationsStatusOrderUserGroup[] {
  const userMap = new Map<
    string,
    Map<string, { sku: string; bifurcation?: string; orderIds: Set<number> }>
  >();

  for (const groups of [a, b]) {
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
  }

  return [...userMap.entries()]
    .map(([userKey, skuMap]) => ({
      userId: userKey === "null" ? null : Number(userKey),
      skus: [...skuMap.values()].map(({ sku, bifurcation, orderIds }) => ({
        sku,
        bifurcation,
        orderIds: [...orderIds].sort((x, y) => x - y),
      })),
    }))
    .sort((x, y) => {
      const xCount = x.skus.reduce((sum, s) => sum + s.orderIds.length, 0);
      const yCount = y.skus.reduce((sum, s) => sum + s.orderIds.length, 0);
      return yCount - xCount;
    });
}

function invertToCountryFirst(
  dayBuckets: OperationsStatusDaysGroup[],
): CountryEntry[] {
  const map = new Map<
    string,
    {
      orders: number;
      dateMap: Map<
        string,
        {
          days: number | null;
          label: string;
          orders: number;
          reasonMap: Map<string, { orders: number; orderGroups: OperationsStatusOrderUserGroup[] }>;
        }
      >;
    }
  >();

  for (const bucket of dayBuckets) {
    for (const cg of bucket.countries) {
      const c = cg.country;
      if (!map.has(c)) map.set(c, { orders: 0, dateMap: new Map() });
      const entry = map.get(c)!;
      entry.orders += cg.orders;

      const dateKey = bucket.days === null ? "null" : String(bucket.days);
      if (!entry.dateMap.has(dateKey)) {
        entry.dateMap.set(dateKey, {
          days: bucket.days,
          label: bucket.label,
          orders: 0,
          reasonMap: new Map(),
        });
      }
      const dateEntry = entry.dateMap.get(dateKey)!;
      dateEntry.orders += cg.orders;

      for (const sg of cg.subgroups) {
        if (!dateEntry.reasonMap.has(sg.label)) {
          dateEntry.reasonMap.set(sg.label, { orders: 0, orderGroups: [] });
        }
        const re = dateEntry.reasonMap.get(sg.label)!;
        re.orders += sg.orders;
        re.orderGroups = mergeUserGroups(re.orderGroups, sg.orderGroups ?? []);
      }
    }
  }

  return [...map.entries()]
    .map(([country, { orders, dateMap }]) => ({
      country,
      orders,
      dates: [...dateMap.values()]
        .map((de) => ({
          days: de.days,
          label: de.label,
          orders: de.orders,
          reasons: [...de.reasonMap.entries()]
            .map(([label, { orders: ro, orderGroups }]) => ({
              label,
              orders: ro,
              orderGroups,
            }))
            .sort((a, b) => b.orders - a.orders),
        }))
        .sort((a, b) => (b.days ?? -1) - (a.days ?? -1)),
    }))
    .sort((a, b) => b.orders - a.orders);
}

// ── daysCountrySubgroup split-panel ──────────────────────────────────────────

function DaysCountrySubgroupSplitPanel({
  data,
}: {
  data: Extract<OperationsStatusOrderDetail, { layout: "daysCountrySubgroup" }>;
}) {
  const subgroupLabel = data.groupBy === "tag" ? "Reason / Tag" : "Product Title";
  const countryFirst = invertToCountryFirst(data.dayBuckets);
  const allCountries: CountryEntry = {
    country: "All",
    orders: data.totalOrders,
    dates: data.dayBuckets.map((b) => ({
      days: b.days,
      label: b.label,
      orders: b.orders,
      reasons: Object.values(
        b.countries.reduce(
          (acc, cg) => {
            for (const sg of cg.subgroups) {
              if (!acc[sg.label]) {
                acc[sg.label] = { label: sg.label, orders: 0, orderGroups: [] as OperationsStatusOrderUserGroup[] };
              }
              acc[sg.label].orders += sg.orders;
              acc[sg.label].orderGroups = mergeUserGroups(
                acc[sg.label].orderGroups,
                sg.orderGroups ?? [],
              );
            }
            return acc;
          },
          {} as Record<string, ReasonEntry>,
        ),
      ).sort((a, b) => b.orders - a.orders),
    })),
  };

  const sidebarCountries = [{ country: "All", orders: data.totalOrders }, ...countryFirst];
  const [selected, setSelected] = useState<CountryBifurcationSelection>({
    country: "All",
    bifurcation: null,
  });

  const activeEntry =
    selected.country === "All"
      ? allCountries
      : countryFirst.find((c) => c.country === selected.country) ?? allCountries;

  const rows: Array<{
    dateLabel: string;
    label: string;
    orders: number;
    orderGroups: OperationsStatusOrderUserGroup[];
  }> = [];

  for (const de of activeEntry.dates) {
    for (const r of de.reasons) {
      const filteredGroups = filterOrderGroups(r.orderGroups, selected.bifurcation);
      if (filteredGroups.length === 0 && selected.bifurcation) continue;
      rows.push({
        dateLabel: de.label,
        label: r.label,
        orders: r.orders,
        orderGroups: filteredGroups,
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <CountryBifurcationSidebar
        countries={sidebarCountries}
        countrySummaries={data.countrySummaries}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <RightPanelHeader showDate subgroupLabel={subgroupLabel} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No orders for this selection.
            </p>
          ) : (
            rows.map((row, i) => (
              <ReasonRow
                key={`${row.dateLabel}-${row.label}-${i}`}
                label={row.label}
                orders={row.orders}
                dateLabel={row.dateLabel}
                showDate
                orderGroups={row.orderGroups}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── countryTag split-panel ────────────────────────────────────────────────────

function CountryTagSplitPanel({
  data,
}: {
  data: Extract<OperationsStatusOrderDetail, { layout: "countryTag" }>;
}) {
  const sidebarCountries = [
    { country: "All", orders: data.totalOrders },
    ...data.countryGroups.map((cg) => ({ country: cg.country, orders: cg.orders })),
  ];
  const [selected, setSelected] = useState<CountryBifurcationSelection>({
    country: "All",
    bifurcation: null,
  });

  const tags: OperationsStatusCountryTagSubgroup[] =
    selected.country === "All"
      ? Object.values(
          data.countryGroups.reduce(
            (acc, cg) => {
              for (const t of cg.tags) {
                if (!acc[t.tag]) {
                  acc[t.tag] = {
                    tag: t.tag,
                    orders: 0,
                    pct: 0,
                    orderIds: [],
                    orderGroups: [],
                  };
                }
                acc[t.tag].orders += t.orders;
                acc[t.tag].orderIds = [...acc[t.tag].orderIds, ...t.orderIds].sort((a, b) => a - b);
                acc[t.tag].orderGroups = mergeUserGroups(
                  acc[t.tag].orderGroups ?? [],
                  t.orderGroups ?? [],
                );
              }
              return acc;
            },
            {} as Record<string, OperationsStatusCountryTagSubgroup>,
          ),
        ).sort((a, b) => b.orders - a.orders)
      : (data.countryGroups.find((cg) => cg.country === selected.country)?.tags ?? []);

  const filteredTags = tags
    .map((t) => ({
      ...t,
      orderGroups: filterOrderGroups(t.orderGroups, selected.bifurcation),
    }))
    .filter((t) => !selected.bifurcation || t.orderGroups.length > 0);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <CountryBifurcationSidebar
        countries={sidebarCountries}
        countrySummaries={data.countrySummaries}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <RightPanelHeader showDate={false} subgroupLabel="Reason / Tag" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredTags.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No orders for this selection.
            </p>
          ) : (
            filteredTags.map((t) => (
              <ReasonRow
                key={t.tag}
                label={t.tag}
                orders={t.orders}
                showDate={false}
                orderGroups={t.orderGroups ?? []}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ data }: { data: OperationsStatusOrderDetail }) {
  const statusPct = pctOfTotal(data.totalOrders, data.filteredTotalOrders);
  const daysHintMap: Record<string, string> = {
    confirmationDate: "Days from confirmation (or order) date to today",
    approvedDate: "Days from approved date to today",
    undeliveredDate: "Days from undelivered date to today",
    shipmentDateLog: "Days from shipment date log to today",
    orderDate: "Days from order date to today",
  };
  const daysHint =
    data.layout === "daysCountrySubgroup"
      ? (daysHintMap[data.daysFrom] ?? "Days from reference date to today")
      : null;

  return (
    <div className="flex shrink-0 flex-wrap gap-4 border-b border-[var(--card-border)] bg-[var(--table-header)]/80 px-5 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          In this status
        </p>
        <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
          {formatNumber(data.totalOrders)}
          <span className="ml-2 text-sm font-medium text-[var(--muted)]">
            {formatPercent(statusPct)}
          </span>
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          In date range
        </p>
        <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
          {formatNumber(data.filteredTotalOrders)}
        </p>
      </div>
      {daysHint ? (
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">{daysHint}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── public exports ────────────────────────────────────────────────────────────

export function OperationsStatusDetailView({
  data,
}: {
  data: OperationsStatusOrderDetail;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SummaryStrip data={data} />
      {data.layout === "countryTag" ? (
        <CountryTagSplitPanel data={data} />
      ) : (
        <DaysCountrySubgroupSplitPanel data={data} />
      )}
    </div>
  );
}

export function operationsStatusDetailBreadcrumb(
  detail: OperationsStatusOrderDetail,
): string {
  if (detail.layout === "countryTag") {
    return "Select country → bifurcation → reason → order details";
  }
  const subgroup = detail.groupBy === "title" ? "product title" : "reason";
  return `Select country → bifurcation → date × ${subgroup} → order details`;
}
