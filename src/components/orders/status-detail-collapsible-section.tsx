"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export function StatusDetailCollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  nested = false,
  orders,
  pct,
  titleClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** Indented tag row inside a country */
  nested?: boolean;
  orders?: number;
  pct?: number;
  titleClassName?: string;
  children: React.ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const showOrders = orders !== undefined;
  const showPct = pct !== undefined;

  return (
    <section
      className={cn(
        nested ? "border-t border-[var(--card-border)]" : "border-b border-[var(--card-border)] last:border-b-0",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[var(--table-header)]/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-inset",
          nested ? "px-5 pl-10" : "px-5",
        )}
      >
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "text-sm font-semibold",
              nested ? "text-[var(--foreground)]" : "text-violet-700 dark:text-violet-300",
              titleClassName,
            )}
          >
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>

        {showOrders || showPct ? (
          <div className="flex shrink-0 items-baseline gap-3 tabular-nums">
            {showOrders ? (
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {formatNumber(orders)}
              </span>
            ) : null}
            {showPct ? (
              <span className="text-sm font-medium text-[var(--muted)]">
                {formatPercent(pct)}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] shadow-sm transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          id={panelId}
          className={cn(
            "min-h-0 overflow-hidden transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <div className={cn("pb-3 pt-0", nested ? "pl-10 pr-5" : "px-5")}>
            {open ? children : null}
          </div>
        </div>
      </div>
    </section>
  );
}
