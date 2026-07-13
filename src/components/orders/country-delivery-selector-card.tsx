"use client";

import {
  CHART_VARIANT_STYLES,
} from "@/components/charts/chart-card-shell";
import type { CountryDeliveryRow } from "@/lib/analytics/orders";
import { cn, formatPercent } from "@/lib/utils";

export function CountryDeliverySelectorCard({
  rows,
  overallDeliveryRatio,
  className,
}: {
  rows: CountryDeliveryRow[];
  overallDeliveryRatio: number;
  className?: string;
}) {
  const style = CHART_VARIANT_STYLES.country;
  const Icon = style.icon;

  return (
    <article
      className={cn(
        "relative flex w-full min-h-[5.75rem] flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-gradient-to-br p-3 shadow-sm ring-1",
        style.gradient,
        style.ring,
        className,
      )}
      aria-label="Delivery ratio by country"
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-50 blur-xl",
          style.iconBg.replace("/15", "/25"),
        )}
        aria-hidden
      />

      <div className="relative flex w-full shrink-0 items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            style.iconBg,
          )}
        >
          <Icon className={cn("h-4 w-4", style.iconColor)} strokeWidth={2.5} />
        </div>
        <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--muted)]">
          Country
        </p>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold leading-none tracking-tight text-[var(--foreground)] tabular-nums">
            {formatPercent(overallDeliveryRatio)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-[var(--muted)]">
            Overall delivery
          </p>
        </div>
      </div>

      <div className="relative mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5">
        {rows.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-[var(--muted)]">
            No country data
          </p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li
                key={row.country}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] leading-tight hover:bg-[var(--card)]/60"
              >
                <span
                  className="min-w-0 truncate font-medium text-[var(--foreground)]"
                  title={row.country}
                >
                  {row.country}
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-[var(--foreground)]">
                  {formatPercent(row.deliveryRatio)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
