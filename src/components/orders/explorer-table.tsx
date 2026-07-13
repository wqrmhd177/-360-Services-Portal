"use client";

import {
  Fragment,
  type ReactNode,
  type ThHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useExplorerSearch } from "@/components/orders/explorer-search-context";
import type { OrderLineItem } from "@/lib/types/order";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getResolvedPayable } from "@/lib/analytics/revenue-imputation";
import { convertToUsd, getCurrencyForCountry } from "@/lib/order-currency";
import { cn, formatLocalCurrency, formatNumber, formatUsd } from "@/lib/utils";

type ExplorerRow = OrderLineItem & {
  orderLines: OrderLineItem[];
};

const DISPLAY_LIMIT = 20;
/** e.g. 18-May 22:34 */
const EXPLORER_DATETIME_FORMAT = "d-MMM HH:mm";

const EXPLORER_ROW_MIN_H = "min-h-10";

export function ExplorerTable({ items }: { items: OrderLineItem[] }) {
  const { search } = useExplorerSearch();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(DISPLAY_LIMIT);

  const rows = useMemo(
    () => groupItemsByOrder(items, search),
    [items, search],
  );

  useEffect(() => {
    setVisibleLimit(DISPLAY_LIMIT);
    setExpandedId(null);
  }, [search, items]);

  const displayRows = rows.slice(0, visibleLimit);
  const hasMore = rows.length > visibleLimit;

  const toggleExpand = (metabaseId: number) => {
    setExpandedId((prev) => (prev === metabaseId ? null : metabaseId));
  };

  return (
    <div className="space-y-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-0">
      <div className="space-y-3 lg:hidden">
        {displayRows.map((row) => (
          <ExplorerMobileCard key={`${row.metabaseId}-m`} row={row} />
        ))}
        {displayRows.length === 0 ? (
          <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No matching orders.
          </p>
        ) : null}
        {rows.length > 0 ? (
          <ExplorerTableFooter
            shown={displayRows.length}
            total={rows.length}
            hasMore={hasMore}
            onLoadMore={() =>
              setVisibleLimit((n) => Math.min(n + DISPLAY_LIMIT, rows.length))
            }
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)]"
          />
        ) : null}
      </div>

      <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="flex max-h-[calc(100dvh-10.5rem)] min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-center text-sm">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b bg-[var(--table-header)] text-[10px] uppercase tracking-wide text-[var(--muted)] shadow-[0_1px_0_var(--card-border)]">
            <tr>
              <ExplorerTh className="px-1" aria-label="Expand" />
              <ExplorerTh>Order #</ExplorerTh>
              <ExplorerTh>OMS ID</ExplorerTh>
              <ExplorerTh>Date</ExplorerTh>
              <ExplorerTh>Status</ExplorerTh>
              <ExplorerTh>Revenue</ExplorerTh>
              <ExplorerTh>Local</ExplorerTh>
              <ExplorerTh>Customer</ExplorerTh>
              <ExplorerTh>Country</ExplorerTh>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const expanded = expandedId === row.metabaseId;
              return (
                <Fragment key={row.metabaseId}>
                  <tr
                    className="cursor-pointer border-b hover:bg-[var(--table-row-hover)]"
                    onClick={() => toggleExpand(row.metabaseId)}
                  >
                    <ExplorerTd className="text-[var(--muted)]">
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                      )}
                    </ExplorerTd>
                    <ExplorerTd className="font-medium tabular-nums" truncate>
                      {row.orderNumber}
                    </ExplorerTd>
                    <ExplorerTd
                      className="font-mono text-xs tabular-nums text-[var(--muted)]"
                      truncate
                    >
                      {row.metabaseId}
                    </ExplorerTd>
                    <ExplorerTd className="whitespace-nowrap text-xs tabular-nums">
                      {formatExplorerDateTime(row.orderDate)}
                    </ExplorerTd>
                    <ExplorerTd>
                      <StatusBadge status={row.status} />
                    </ExplorerTd>
                    <ExplorerTd className="whitespace-nowrap font-medium tabular-nums">
                      <RevenueUsdCell row={row} />
                    </ExplorerTd>
                    <ExplorerTd className="whitespace-nowrap text-xs tabular-nums text-[var(--muted)]">
                      <RevenueLocalCell row={row} />
                    </ExplorerTd>
                    <ExplorerTd truncate title={row.fullName}>
                      {row.fullName}
                    </ExplorerTd>
                    <ExplorerTd truncate className="text-xs" title={row.country}>
                      {row.country}
                    </ExplorerTd>
                  </tr>
                  {expanded ? (
                    <tr className="border-b bg-[var(--table-row-hover)]/40">
                      <td colSpan={9} className="px-3 py-2 text-left">
                        <ExplorerOrderDetails row={row} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
            </table>
            {displayRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-[var(--muted)]">
                No matching orders.
              </p>
            ) : null}
          </div>
          {rows.length > 0 ? (
            <ExplorerTableFooter
              shown={displayRows.length}
              total={rows.length}
              hasMore={hasMore}
              onLoadMore={() =>
                setVisibleLimit((n) => Math.min(n + DISPLAY_LIMIT, rows.length))
              }
              className="shrink-0 border-t border-[var(--card-border)] bg-[var(--card)]"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExplorerTh({
  children,
  className,
  ...rest
}: {
  children?: ReactNode;
  className?: string;
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={cn("bg-[var(--table-header)] p-0 align-middle", className)}
    >
      <div
        className={cn(
          "flex w-full items-center justify-center px-2 text-center",
          EXPLORER_ROW_MIN_H,
        )}
      >
        {children}
      </div>
    </th>
  );
}

function ExplorerTd({
  children,
  truncate: truncateCell,
  className,
  title,
}: {
  children: ReactNode;
  truncate?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <td className="p-0 align-middle" title={title}>
      <div
        className={cn(
          "flex w-full items-center justify-center px-2 text-center",
          EXPLORER_ROW_MIN_H,
          className,
        )}
      >
        {truncateCell ? (
          <span className="min-w-0 max-w-full truncate">{children}</span>
        ) : (
          children
        )}
      </div>
    </td>
  );
}

function ExplorerTableFooter({
  shown,
  total,
  hasMore,
  onLoadMore,
  className,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--muted)]",
        className,
      )}
    >
      <p>
        Showing{" "}
        <span className="font-medium tabular-nums text-[var(--foreground)]">
          {formatNumber(shown)}
        </span>{" "}
        of{" "}
        <span className="font-medium tabular-nums text-[var(--foreground)]">
          {formatNumber(total)}
        </span>{" "}
        orders
      </p>
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="shrink-0 rounded-md border border-[var(--card-border)] bg-[var(--table-header)] px-3 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--table-row-hover)]"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}

function ExplorerMobileCard({ row }: { row: ExplorerRow }) {
  return (
    <article className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold tabular-nums">{row.orderNumber}</span>
          <span className="font-mono text-[10px] text-[var(--muted)]">
            OMS {row.metabaseId}
          </span>
          <StatusBadge status={row.status} />
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
          {formatExplorerDateTime(row.orderDate)} · {row.country} ·{" "}
          <span className="font-medium text-[var(--foreground)]">
            <RevenueUsdCell row={row} />
          </span>
          {" · "}
          <RevenueLocalCell row={row} />
        </p>
      </div>

      <div className="mt-2 border-t border-[var(--card-border)] pt-2">
        <ExplorerOrderDetails row={row} />
      </div>
    </article>
  );
}

function ExplorerOrderDetails({ row }: { row: ExplorerRow }) {
  const titles = uniqueTitles(row.orderLines);

  return (
    <div className="space-y-1 text-left text-[11px] leading-snug">
      {titles ? (
        <p className="text-left text-[var(--foreground)]">
          <span className="text-[var(--muted)]">Line items:</span> {titles}
        </p>
      ) : null}
      <CompactDetailRow>
        <CompactField label="Name" value={row.fullName} />
        <CompactField label="Phone" value={row.phone} />
        <CompactField label="City" value={row.city} />
        <CompactField label="Country" value={row.country} />
      </CompactDetailRow>
      {row.shipping.trim() ? (
        <p
          className="truncate text-left text-[var(--foreground)]"
          title={row.shipping}
        >
          <span className="text-[var(--muted)]">Shipping:</span> {row.shipping}
        </p>
      ) : null}
      <CompactDetailRow>
        <CompactField label="Tracking" value={row.courierTrackingId} mono />
        <CompactField label="Tag" value={row.tag} />
        <CompactField label="Undel. tag" value={row.undeliveredTag ?? ""} />
        <CompactField label="OP remarks" value={row.opRemarks} />
      </CompactDetailRow>
      <CompactDetailRow>
        <CompactField label="AM" value={row.accountManager} />
        <CompactField label="Updated by" value={row.updateUser ?? ""} />
      </CompactDetailRow>
      <CompactDateRow row={row} />
    </div>
  );
}

function CompactDetailRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">{children}</div>
  );
}

function CompactField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const display = value.trim();
  if (!display) return null;
  return (
    <span className="inline-flex max-w-full min-w-0 gap-1">
      <span className="shrink-0 text-[var(--muted)]">{label}:</span>
      <span
        className={cn(
          "truncate text-[var(--foreground)]",
          mono && "font-mono text-[10px]",
        )}
        title={display}
      >
        {display}
      </span>
    </span>
  );
}

function CompactDateRow({ row }: { row: ExplorerRow }) {
  const dates: { label: string; value: string }[] = [
    { label: "Order", value: formatExplorerDateTime(row.orderDate) },
    { label: "Approved", value: formatExplorerDateTime(row.approvedDate) },
    { label: "Shipment", value: formatExplorerDateTime(row.shipmentDateLog) },
    { label: "Delivered", value: formatExplorerDateTime(row.deliveredDate) },
    { label: "Undelivered", value: formatExplorerDateTime(row.undeliveredDate) },
    { label: "Reschedule", value: formatExplorerDateTime(row.rescheduleDate) },
  ].filter((d) => d.value !== "—");

  if (!dates.length) return null;

  return (
    <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
      {dates.map((d, i) => (
        <span key={d.label}>
          {i > 0 ? <span className="text-[var(--muted)]">· </span> : null}
          <span className="text-[var(--muted)]">{d.label}</span>{" "}
          <span className="text-[var(--foreground)]">{d.value}</span>
        </span>
      ))}
    </p>
  );
}

function groupItemsByOrder(
  items: OrderLineItem[],
  search: string,
): ExplorerRow[] {
  const q = search.toLowerCase().trim();
  const filtered = items.filter((i) => matchesSearch(i, q));

  const byOrder = new Map<number, OrderLineItem[]>();
  for (const item of filtered) {
    const list = byOrder.get(item.metabaseId) ?? [];
    list.push(item);
    byOrder.set(item.metabaseId, list);
  }

  return [...byOrder.values()].map((orderLines) => ({
    ...orderLines[0],
    orderLines,
  }));
}

function matchesSearch(item: OrderLineItem, q: string): boolean {
  if (!q) return true;
  return (
    item.orderNumber.toLowerCase().includes(q) ||
    item.sku.toLowerCase().includes(q) ||
    item.fullName.toLowerCase().includes(q) ||
    item.title.toLowerCase().includes(q) ||
    item.phone.toLowerCase().includes(q) ||
    item.courierTrackingId.toLowerCase().includes(q)
  );
}

function uniqueTitles(lines: OrderLineItem[]): string {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const line of lines) {
    const t = line.title.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    titles.push(t);
  }
  return titles.join(" · ");
}

function formatExplorerDateTime(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "—";
  return format(date, EXPLORER_DATETIME_FORMAT);
}

function linesForRevenue(row: ExplorerRow): OrderLineItem[] {
  return row.orderLines;
}

function revenueUsdForLines(lines: OrderLineItem[]): number {
  return lines.reduce(
    (sum, line) =>
      sum + convertToUsd(getResolvedPayable(line), line.country, line.sku),
    0,
  );
}

function resolvedLocalForLines(lines: OrderLineItem[]): number {
  return lines.reduce((sum, line) => sum + getResolvedPayable(line), 0);
}

function isEstimatedRevenue(lines: OrderLineItem[]): boolean {
  return lines.some((line) => line.payableEstimated);
}

function RevenueUsdCell({ row }: { row: ExplorerRow }) {
  const lines = linesForRevenue(row);
  const usd = revenueUsdForLines(lines);
  const estimated = isEstimatedRevenue(lines);
  return (
    <span
      title={
        estimated
          ? "Estimated from last order for this product in this country"
          : undefined
      }
    >
      {formatUsd(usd)}
      {estimated ? (
        <span className="ml-1 text-[10px] font-normal text-[var(--muted)]">
          ~
        </span>
      ) : null}
    </span>
  );
}

function RevenueLocalCell({ row }: { row: ExplorerRow }) {
  const lines = linesForRevenue(row);
  const local = resolvedLocalForLines(lines);
  const estimated = isEstimatedRevenue(lines);
  const currency = getCurrencyForCountry(row.country, row.sku);
  return (
    <span
      title={
        estimated
          ? "Estimated from last order for this product in this country"
          : undefined
      }
    >
      {formatLocalCurrency(local, currency)}
      {estimated ? (
        <span className="ml-1 text-[10px] font-normal opacity-80">~</span>
      ) : null}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Delivered"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Return" || status === "Returned"
        ? "bg-red-100 text-red-800"
        : "bg-[var(--table-row-hover)] text-[var(--foreground)]";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-center truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
        color,
      )}
      title={status}
    >
      {status}
    </span>
  );
}

