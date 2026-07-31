"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
import type {
  OperationsStatusDaysGroup,
  OperationsStatusSubgroup,
  OperationsStatusCountryTagSubgroup,
} from "@/lib/analytics/operations-status-detail";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function pctOfTotal(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

// ── order ID chip list ────────────────────────────────────────────────────────

function OrderIdList({ orderIds }: { orderIds: number[] }) {
  if (orderIds.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-[var(--muted)]">No orders.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5 py-2">
      {orderIds.map((id) => (
        <li
          key={id}
          className="rounded-md border border-[var(--card-border)] bg-[var(--card)] px-2 py-0.5 font-mono text-xs tabular-nums text-[var(--foreground)]"
        >
          {id}
        </li>
      ))}
    </ul>
  );
}

// ── expandable reason row (right panel) ──────────────────────────────────────

function ReasonRow({
  label,
  orders,
  dateLabel,
  showDate,
  orderIds,
}: {
  label: string;
  orders: number;
  dateLabel?: string;
  showDate: boolean;
  orderIds: number[];
}) {
  const [open, setOpen] = useState(false);

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
        <span className="min-w-0 flex-1 text-sm text-[var(--foreground)] truncate">
          {label}
        </span>
        <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
          {formatNumber(orders)}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
        )}
      </button>
      {open && (
        <div className="bg-[var(--table-header)]/40 px-4 pb-2">
          <OrderIdList orderIds={orderIds} />
        </div>
      )}
    </div>
  );
}

// ── country sidebar ───────────────────────────────────────────────────────────

function CountrySidebar({
  countries,
  selected,
  onSelect,
}: {
  countries: Array<{ country: string; orders: number }>;
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="flex w-36 shrink-0 flex-col border-r border-[var(--card-border)] overflow-y-auto">
      {countries.map(({ country, orders }) => {
        const active = selected === country;
        return (
          <button
            key={country}
            type="button"
            onClick={() => onSelect(country)}
            className={cn(
              "flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors border-b border-[var(--card-border)] last:border-0",
              active
                ? "bg-teal-600 text-white font-semibold"
                : "text-[var(--foreground)] hover:bg-[var(--table-header)]",
            )}
          >
            <span className="min-w-0 truncate">{country}</span>
            <span
              className={cn(
                "shrink-0 tabular-nums font-medium",
                active ? "text-white/90" : "text-[var(--muted)]",
              )}
            >
              {formatNumber(orders)}
            </span>
          </button>
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

type ReasonEntry = { label: string; orders: number; orderIds: number[] };
type DateEntry = { days: number | null; label: string; orders: number; reasons: ReasonEntry[] };
type CountryEntry = { country: string; orders: number; dates: DateEntry[] };

function invertToCountryFirst(
  dayBuckets: OperationsStatusDaysGroup[],
): CountryEntry[] {
  const map = new Map<string, { orders: number; dateMap: Map<string, { days: number | null; label: string; orders: number; reasonMap: Map<string, { orders: number; orderIds: Set<number> }> }> }>();

  for (const bucket of dayBuckets) {
    for (const cg of bucket.countries) {
      const c = cg.country;
      if (!map.has(c)) map.set(c, { orders: 0, dateMap: new Map() });
      const entry = map.get(c)!;
      entry.orders += cg.orders;

      const dateKey = bucket.days === null ? "null" : String(bucket.days);
      if (!entry.dateMap.has(dateKey)) {
        entry.dateMap.set(dateKey, { days: bucket.days, label: bucket.label, orders: 0, reasonMap: new Map() });
      }
      const dateEntry = entry.dateMap.get(dateKey)!;
      dateEntry.orders += cg.orders;

      for (const sg of cg.subgroups) {
        if (!dateEntry.reasonMap.has(sg.label)) {
          dateEntry.reasonMap.set(sg.label, { orders: 0, orderIds: new Set() });
        }
        const re = dateEntry.reasonMap.get(sg.label)!;
        re.orders += sg.orders;
        for (const id of sg.orderIds) re.orderIds.add(id);
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
            .map(([label, { orders: ro, orderIds }]) => ({
              label,
              orders: ro,
              orderIds: [...orderIds].sort((a, b) => a - b),
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
              if (!acc[sg.label]) acc[sg.label] = { label: sg.label, orders: 0, orderIds: new Set<number>() };
              acc[sg.label].orders += sg.orders;
              for (const id of sg.orderIds) acc[sg.label].orderIds.add(id);
            }
            return acc;
          },
          {} as Record<string, { label: string; orders: number; orderIds: Set<number> }>,
        ),
      )
        .map(({ label, orders, orderIds }) => ({
          label,
          orders,
          orderIds: [...orderIds].sort((a, b) => a - b),
        }))
        .sort((a, b) => b.orders - a.orders),
    })),
  };

  const sidebarCountries = [allCountries, ...countryFirst];
  const [selectedCountry, setSelectedCountry] = useState("All");

  const activeEntry =
    selectedCountry === "All"
      ? allCountries
      : countryFirst.find((c) => c.country === selectedCountry) ?? allCountries;

  // Flatten date × reason into a single list of rows
  const rows: Array<{ dateLabel: string; label: string; orders: number; orderIds: number[] }> = [];
  for (const de of activeEntry.dates) {
    for (const r of de.reasons) {
      rows.push({ dateLabel: de.label, label: r.label, orders: r.orders, orderIds: r.orderIds });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <CountrySidebar
        countries={sidebarCountries.map(({ country, orders }) => ({ country, orders }))}
        selected={selectedCountry}
        onSelect={setSelectedCountry}
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
                orderIds={row.orderIds}
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
  const [selectedCountry, setSelectedCountry] = useState("All");

  const tags: OperationsStatusCountryTagSubgroup[] =
    selectedCountry === "All"
      ? Object.values(
          data.countryGroups.reduce(
            (acc, cg) => {
              for (const t of cg.tags) {
                if (!acc[t.tag]) acc[t.tag] = { tag: t.tag, orders: 0, pct: 0, orderIds: [] };
                acc[t.tag].orders += t.orders;
                acc[t.tag].orderIds = [...acc[t.tag].orderIds, ...t.orderIds].sort((a, b) => a - b);
              }
              return acc;
            },
            {} as Record<string, OperationsStatusCountryTagSubgroup>,
          ),
        ).sort((a, b) => b.orders - a.orders)
      : (data.countryGroups.find((cg) => cg.country === selectedCountry)?.tags ?? []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <CountrySidebar
        countries={sidebarCountries}
        selected={selectedCountry}
        onSelect={setSelectedCountry}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <RightPanelHeader showDate={false} subgroupLabel="Reason / Tag" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tags.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No orders for this selection.
            </p>
          ) : (
            tags.map((t) => (
              <ReasonRow
                key={t.tag}
                label={t.tag}
                orders={t.orders}
                showDate={false}
                orderIds={t.orderIds}
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
    return "Select country → reason → order IDs";
  }
  const subgroup = detail.groupBy === "title" ? "product title" : "reason";
  return `Select country → date × ${subgroup} → order IDs`;
}
