"use client";

import type {
  StandardStatusDetail,
  StandardStatusProductRow,
} from "@/lib/analytics/status-detail";
import { StatusDetailCollapsibleSection } from "@/components/orders/status-detail-collapsible-section";
import { StatusDetailOrderNumberList } from "@/components/orders/status-detail-order-number-list";
import { formatNumber } from "@/lib/utils";

function ProductList({ rows }: { rows: StandardStatusProductRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-[var(--muted)]">
        No products for this tag.
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

function CountrySection({
  country,
  orders,
  pct,
  tags,
}: {
  country: string;
  orders: number;
  pct: number;
  tags: StandardStatusDetail["countries"][number]["tags"];
}) {
  return (
    <StatusDetailCollapsibleSection
      title={country}
      orders={orders}
      pct={pct}
      defaultOpen={false}
    >
      {tags.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--muted)]">
          No tags for this country.
        </p>
      ) : (
        <div className="-mx-1 rounded-lg border border-[var(--card-border)] bg-[var(--table-header)]/40">
          {tags.map((tagGroup) => (
            <StatusDetailCollapsibleSection
              key={tagGroup.tag}
              nested
              title={tagGroup.tag}
              orders={tagGroup.orders}
              pct={tagGroup.pct}
              defaultOpen={false}
            >
              <ProductList rows={tagGroup.products} />
            </StatusDetailCollapsibleSection>
          ))}
        </div>
      )}
    </StatusDetailCollapsibleSection>
  );
}

export function StatusDetailStandardView({
  data,
}: {
  data: StandardStatusDetail;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap gap-4 border-b border-[var(--card-border)] bg-[var(--table-header)]/80 px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {data.status} orders
          </p>
          <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
            {formatNumber(data.totalOrders)}
          </p>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        role="region"
        aria-label={`${data.status} breakdown by country, tag, and product`}
      >
        {data.countries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
            No orders for this status.
          </p>
        ) : (
          data.countries.map((group) => (
            <CountrySection
              key={group.country}
              country={group.country}
              orders={group.orders}
              pct={group.pct}
              tags={group.tags}
            />
          ))
        )}
      </div>
    </div>
  );
}
