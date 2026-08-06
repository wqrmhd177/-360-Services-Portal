"use client";

import type { NdStuckOrderRow } from "@/lib/operations/ndReport";
import { formatPortalYmdMedium } from "@/lib/portalTimezone";
import { formatNumber } from "@/lib/utils";

function formatApprovedDate(value: string | null): string {
  if (!value) return "—";
  const ymd = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return formatPortalYmdMedium(ymd);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return value;
}

function sortOrders(orders: NdStuckOrderRow[]): NdStuckOrderRow[] {
  return [...orders].sort((a, b) => {
    const aTime = a.approved_date
      ? new Date(a.approved_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bTime = b.approved_date
      ? new Date(b.approved_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.order_id - b.order_id;
  });
}

export function NdStoreOrdersInline({ orders }: { orders: NdStuckOrderRow[] }) {
  const sorted = sortOrders(orders);

  if (sorted.length === 0) {
    return (
      <p className="py-2 text-xs text-[var(--muted)]">No stuck orders for this store.</p>
    );
  }

  return (
    <div className="space-y-1 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Stuck orders
      </p>
      <ul className="space-y-1">
        {sorted.map((order) => (
          <li
            key={`${order.order_id}-${order.store_id}-${order.sku}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-[var(--card-border)]/60 bg-[var(--card)] px-2.5 py-1.5 text-xs"
          >
            <span className="whitespace-nowrap tabular-nums text-[var(--foreground)]">
              {formatApprovedDate(order.approved_date)}
            </span>
            <span className="text-[var(--muted)]">·</span>
            <span className="font-mono tabular-nums">{order.order_id}</span>
            <span className="text-[var(--muted)]">·</span>
            <span className="max-w-[220px] truncate font-mono text-[10px]" title={order.sku}>
              {order.sku}
            </span>
            <span className="text-[var(--muted)]">·</span>
            <span className="tabular-nums text-[var(--muted)]">
              ND {formatNumber(order.nd_quantity)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
