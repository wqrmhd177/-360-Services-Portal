"use client";

import type { BreakdownRow } from "@/lib/analytics/orders";
import { cn, formatNumber, formatPercent, formatUsd } from "@/lib/utils";

export function BreakdownMetricList({
  rows,
  colorForName,
  onRowClick,
}: {
  rows: BreakdownRow[];
  colorForName: (name: string, index: number) => string;
  onRowClick?: (row: BreakdownRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted)]">
        No data for the current filters.
      </p>
    );
  }

  return (
    <ul className="flex max-h-[min(28rem,60vh)] flex-col gap-2 overflow-y-auto pr-1">
      {rows.map((row, index) => {
        const color = colorForName(row.name, index);
        const widthPct = Math.min(100, Math.max(0, row.pct * 100));
        const clickable = Boolean(onRowClick);

        const content = (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span
                  className="truncate text-sm font-semibold text-[var(--foreground)]"
                  title={row.name}
                >
                  {row.name}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--muted)]">
                {formatPercent(row.pct)}
              </span>
            </div>

            <div
              className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--table-row-hover)]/90"
              aria-hidden
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>

            <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
              <div>
                <dt className="text-[var(--muted)]">Orders</dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatNumber(row.orders)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Revenue</dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatUsd(row.revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Units</dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatNumber(row.units)}
                </dd>
              </div>
            </dl>
          </>
        );

        if (clickable) {
          return (
            <li key={row.name}>
              <button
                type="button"
                aria-label={`View details for ${row.name}`}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)]/55 px-3 py-2.5 text-left shadow-sm backdrop-blur-sm",
                  "cursor-pointer transition-all hover:border-violet-200/80 hover:bg-[var(--card)]/90 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2",
                )}
              >
                {content}
              </button>
            </li>
          );
        }

        return (
          <li
            key={row.name}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--card)]/55 px-3 py-2.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--card)]/80"
          >
            {content}
          </li>
        );
      })}
    </ul>
  );
}
