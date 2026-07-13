"use client";

import type { OperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
import { StatusDetailCollapsibleSection } from "@/components/orders/status-detail-collapsible-section";
import { formatNumber, formatPercent } from "@/lib/utils";

function pctOfTotal(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

function OrderIdList({ orderIds }: { orderIds: number[] }) {
  if (orderIds.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-[var(--muted)]">No orders.</p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5 py-1">
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

function NestedGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 rounded-lg border border-[var(--card-border)] bg-[var(--table-header)]/40">
      {children}
    </div>
  );
}

function SubgroupSection({
  label,
  orders,
  filteredTotalOrders,
  orderIds,
}: {
  label: string;
  orders: number;
  filteredTotalOrders: number;
  orderIds: number[];
}) {
  return (
    <StatusDetailCollapsibleSection
      nested
      title={label}
      orders={orders}
      pct={pctOfTotal(orders, filteredTotalOrders)}
      defaultOpen={false}
    >
      <OrderIdList orderIds={orderIds} />
    </StatusDetailCollapsibleSection>
  );
}

function CountrySection({
  country,
  orders,
  subgroups,
  subgroupLabel,
  filteredTotalOrders,
}: {
  country: string;
  orders: number;
  subgroups: Extract<
    OperationsStatusOrderDetail,
    { layout: "daysCountrySubgroup" }
  >["dayBuckets"][number]["countries"][number]["subgroups"];
  subgroupLabel: string;
  filteredTotalOrders: number;
}) {
  return (
    <StatusDetailCollapsibleSection
      nested
      title={country}
      orders={orders}
      pct={pctOfTotal(orders, filteredTotalOrders)}
      defaultOpen={false}
    >
      {subgroups.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--muted)]">
          No {subgroupLabel.toLowerCase()}s for this country.
        </p>
      ) : (
        <NestedGroup>
          {subgroups.map((sub) => (
            <SubgroupSection
              key={sub.label}
              label={sub.label}
              orders={sub.orders}
              filteredTotalOrders={filteredTotalOrders}
              orderIds={sub.orderIds}
            />
          ))}
        </NestedGroup>
      )}
    </StatusDetailCollapsibleSection>
  );
}

function DaysSection({
  bucket,
  subgroupLabel,
  filteredTotalOrders,
}: {
  bucket: Extract<
    OperationsStatusOrderDetail,
    { layout: "daysCountrySubgroup" }
  >["dayBuckets"][number];
  subgroupLabel: string;
  filteredTotalOrders: number;
}) {
  return (
    <StatusDetailCollapsibleSection
      title={bucket.label}
      orders={bucket.orders}
      pct={pctOfTotal(bucket.orders, filteredTotalOrders)}
      defaultOpen={false}
    >
      {bucket.countries.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--muted)]">
          No countries for this day bucket.
        </p>
      ) : (
        <NestedGroup>
          {bucket.countries.map((group) => (
            <CountrySection
              key={group.country}
              country={group.country}
              orders={group.orders}
              subgroups={group.subgroups}
              subgroupLabel={subgroupLabel}
              filteredTotalOrders={filteredTotalOrders}
            />
          ))}
        </NestedGroup>
      )}
    </StatusDetailCollapsibleSection>
  );
}

function ReturnTagSection({
  tag,
  orders,
  pct,
  orderIds,
}: {
  tag: string;
  orders: number;
  pct: number;
  orderIds: number[];
}) {
  return (
    <StatusDetailCollapsibleSection
      nested
      title={tag}
      orders={orders}
      pct={pct}
      defaultOpen={false}
    >
      <OrderIdList orderIds={orderIds} />
    </StatusDetailCollapsibleSection>
  );
}

function ReturnCountrySection({
  country,
  orders,
  tags,
  filteredTotalOrders,
}: {
  country: string;
  orders: number;
  tags: Extract<
    OperationsStatusOrderDetail,
    { layout: "countryTag" }
  >["countryGroups"][number]["tags"];
  filteredTotalOrders: number;
}) {
  return (
    <StatusDetailCollapsibleSection
      title={country}
      orders={orders}
      pct={pctOfTotal(orders, filteredTotalOrders)}
      defaultOpen={false}
    >
      {tags.length === 0 ? (
        <p className="py-3 text-center text-sm text-[var(--muted)]">
          No tags for this country.
        </p>
      ) : (
        <NestedGroup>
          {tags.map((group) => (
            <ReturnTagSection
              key={group.tag}
              tag={group.tag}
              orders={group.orders}
              pct={group.pct}
              orderIds={group.orderIds}
            />
          ))}
        </NestedGroup>
      )}
    </StatusDetailCollapsibleSection>
  );
}

function SummaryStrip({ data }: { data: OperationsStatusOrderDetail }) {
  const statusPct = pctOfTotal(data.totalOrders, data.filteredTotalOrders);
  const daysHint =
    data.layout === "daysCountrySubgroup"
      ? data.daysFrom === "orderDate"
        ? "Days = calendar days from order date to today"
        : "Days = calendar days from shipment date log to today"
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

function DaysCountrySubgroupBody({
  data,
}: {
  data: Extract<OperationsStatusOrderDetail, { layout: "daysCountrySubgroup" }>;
}) {
  const subgroupLabel = data.groupBy === "tag" ? "Tag" : "Title";

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      role="region"
      aria-label={`${data.title} breakdown by days, country, and ${subgroupLabel.toLowerCase()}`}
    >
      {data.dayBuckets.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
          No orders for this status.
        </p>
      ) : (
        data.dayBuckets.map((bucket) => (
          <DaysSection
            key={`${bucket.days ?? "null"}-${bucket.label}`}
            bucket={bucket}
            subgroupLabel={subgroupLabel}
            filteredTotalOrders={data.filteredTotalOrders}
          />
        ))
      )}
    </div>
  );
}

function CountryTagBody({
  data,
}: {
  data: Extract<OperationsStatusOrderDetail, { layout: "countryTag" }>;
}) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      role="region"
      aria-label={`${data.title} breakdown by country and tag`}
    >
      {data.countryGroups.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
          No orders for this status.
        </p>
      ) : (
        data.countryGroups.map((group) => (
          <ReturnCountrySection
            key={group.country}
            country={group.country}
            orders={group.orders}
            tags={group.tags}
            filteredTotalOrders={data.filteredTotalOrders}
          />
        ))
      )}
    </div>
  );
}

export function OperationsStatusDetailView({
  data,
}: {
  data: OperationsStatusOrderDetail;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SummaryStrip data={data} />
      {data.layout === "countryTag" ? (
        <CountryTagBody data={data} />
      ) : (
        <DaysCountrySubgroupBody data={data} />
      )}
    </div>
  );
}

export function operationsStatusDetailBreadcrumb(
  detail: OperationsStatusOrderDetail,
): string {
  if (detail.layout === "countryTag") {
    return "Country → tag → order ids";
  }
  const subgroup = detail.groupBy === "title" ? "title" : "tag";
  return `Days → country → ${subgroup} → order ids`;
}
