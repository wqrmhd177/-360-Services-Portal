"use client";

import { Suspense, useCallback, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { usePortalNavigation } from "@/components/layout/navigation-loading";
import { SHEET_ANALYTICS_COUNTRIES } from "@/lib/operations/sheetCountries";
import { cn } from "@/lib/utils";

function SheetAnalyticsFilterBarInner({
  country,
  from,
  to,
  direction = "",
  hideCountry = false,
  showDirection = false,
}: {
  country: string;
  from: string;
  to: string;
  direction?: string;
  hideCountry?: boolean;
  showDirection?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { push: navigate } = usePortalNavigation();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      startTransition(() => {
        navigate(query ? `${pathname}?${query}` : pathname);
      });
    },
    [navigate, pathname, searchParams],
  );

  const hasFilters = Boolean(country || from || to || direction);

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-2.5 shadow-sm">
      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-3",
          hideCountry && !showDirection && "sm:grid-cols-2",
          isPending && "opacity-70",
        )}
      >
        {hideCountry ? null : (
          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Country
            </span>
            <select
              value={country}
              onChange={(e) => updateParams({ country: e.target.value })}
              className="h-10 w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)]"
            >
              <option value="">All</option>
              {SHEET_ANALYTICS_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {showDirection ? (
          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Direction
            </span>
            <select
              value={direction}
              onChange={(e) => updateParams({ direction: e.target.value })}
              className="h-10 w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)]"
            >
              <option value="">All</option>
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </label>
        ) : null}

        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Start date
          </span>
          <div className="relative">
            <input
              type="date"
              value={from}
              onChange={(e) => updateParams({ from: e.target.value })}
              className="h-10 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-3 pr-10 text-sm text-[var(--foreground)] shadow-sm"
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </div>
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            End date
          </span>
          <div className="relative">
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => updateParams({ to: e.target.value })}
              className="h-10 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-3 pr-10 text-sm text-[var(--foreground)] shadow-sm"
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </div>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--card-border)] pt-2">
        <p className="text-xs text-[var(--muted)]">
          {from || to
            ? `Showing ${from || "…"} to ${to || "…"}`
            : "Date: All (no date filter applied)"}
          {direction ? ` · ${direction}` : ""}
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              updateParams({ country: "", from: "", to: "", direction: "" })
            }
            className="text-xs font-medium text-teal-600 hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SheetAnalyticsFilterBar(props: {
  country: string;
  from: string;
  to: string;
  direction?: string;
  hideCountry?: boolean;
  showDirection?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="h-20 animate-pulse rounded-xl border border-[var(--card-border)] bg-[var(--table-header)]" />
      }
    >
      <SheetAnalyticsFilterBarInner {...props} />
    </Suspense>
  );
}
