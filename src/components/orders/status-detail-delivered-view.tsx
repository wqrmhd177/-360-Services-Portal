"use client";

import { useMemo } from "react";
import type {
  DeliveredStatusDetail,
  StatusCountryGroup,
  StatusProductRow,
} from "@/lib/analytics/status-detail";
import { sortDeliveredStatusDetail } from "@/lib/analytics/status-detail";
import { StatusDetailCollapsibleSection } from "@/components/orders/status-detail-collapsible-section";
import { StatusDetailOrderNumberList } from "@/components/orders/status-detail-order-number-list";
import { formatNumber, formatPercent } from "@/lib/utils";

function formatRate(value: number | null): string {
  return value === null ? "—" : formatPercent(value);
}

function productSubtitle(row: StatusProductRow): string {
  return `${formatNumber(row.units)} units · Dispatch → Deliver ${formatRate(row.dispatchToDeliver)} · Receive → Deliver ${formatRate(row.receiveToDeliver)}`;
}

function ProductList({ rows }: { rows: StatusProductRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-[var(--muted)]">
        No products for this country.
      </p>
    );
  }

  return (
    <div className="-mx-1 rounded-lg border border-[var(--card-border)] bg-[var(--table-header)]/40">
      {rows.map((row) => (
        <StatusDetailCollapsibleSection
          key={row.product}
          nested
          title={row.product}
          subtitle={productSubtitle(row)}
          orders={row.orders}
          pct={row.pct}
          defaultOpen={false}
        >
          <StatusDetailOrderNumberList orderNumbers={row.orderNumbers} />
        </StatusDetailCollapsibleSection>
      ))}
    </div>
  );
}

function CountrySection({ group }: { group: StatusCountryGroup }) {
  return (
    <StatusDetailCollapsibleSection
      title={group.country}
      orders={group.orders}
      pct={group.pct}
      defaultOpen={false}
    >
      <ProductList rows={group.products} />
    </StatusDetailCollapsibleSection>
  );
}

export function StatusDetailSummaryStrip({
  totalDeliveredOrders,
  totalUnits,
}: {
  totalDeliveredOrders: number;
  totalUnits: number;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-4 border-b border-[var(--card-border)] bg-[var(--table-header)]/80 px-5 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Delivered orders
        </p>
        <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
          {formatNumber(totalDeliveredOrders)}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Total units
        </p>
        <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
          {formatNumber(totalUnits)}
        </p>
      </div>
    </div>
  );
}

export function StatusDetailDeliveredView({
  data,
}: {
  data: DeliveredStatusDetail;
}) {
  const sorted = useMemo(() => sortDeliveredStatusDetail(data), [data]);

  if (sorted.countries.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
        No delivered orders for the current filters.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StatusDetailSummaryStrip
        totalDeliveredOrders={sorted.totalDeliveredOrders}
        totalUnits={sorted.totalUnits}
      />
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        role="region"
        aria-label="Delivered breakdown by country and product"
      >
        {sorted.countries.map((group) => (
          <CountrySection key={group.country} group={group} />
        ))}
      </div>
    </div>
  );
}
