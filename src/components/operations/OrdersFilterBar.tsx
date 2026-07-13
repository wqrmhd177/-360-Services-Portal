"use client";

import { Suspense, useCallback, useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { usePortalNavigation } from "@/components/layout/navigation-loading";
import {
  StoreIdSearchSelect,
  type StoreOption,
} from "@/components/operations/StoreIdSearchSelect";
import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";
import { cn } from "@/lib/utils";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
  storeIds?: number[];
  storeOptions?: StoreOption[];
}

interface OrdersFilterBarProps {
  options: FilterOptions;
  country: string;
  bifurcation: string;
  from: string;
  to: string;
  storeId?: string;
  showStoreFilter?: boolean;
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--foreground)] shadow-sm",
          "transition-colors hover:border-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {children}
      </select>
    </label>
  );
}

function OrdersFilterBarInner({
  options,
  country,
  bifurcation,
  storeId = "",
  showStoreFilter = false,
}: OrdersFilterBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { push: navigate } = usePortalNavigation();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => {
        navigate(`${pathname}?${params.toString()}`);
      });
    },
    [navigate, pathname, searchParams],
  );

  const clearFacetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("country");
    params.delete("bifurcation");
    params.delete("store_id");
    startTransition(() => {
      navigate(`${pathname}?${params.toString()}`);
    });
  };

  const hasFacetFilters = !!(country || bifurcation || (showStoreFilter && storeId));

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-3 shadow-sm sm:p-4">
      <div
        className={cn(
          "grid gap-3",
          showStoreFilter
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        <FilterSelect
          label="Country"
          value={country}
          disabled={isPending}
          onChange={(value) => updateParam("country", value)}
        >
          <option value="">All countries</option>
          {options.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Bifurcation"
          value={bifurcation}
          disabled={isPending}
          onChange={(value) => updateParam("bifurcation", value)}
        >
          <option value="">All bifurcations</option>
          {options.bifurcations.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </FilterSelect>

        {showStoreFilter ? (
          <StoreIdSearchSelect
            value={storeId}
            disabled={isPending}
            onChange={(value) => updateParam("store_id", value)}
            options={
              options.storeOptions ??
              (options.storeIds ?? []).map((id) => ({
                id,
                label: String(id),
              }))
            }
          />
        ) : null}

        <DateRangePicker layout="stacked" className="min-w-0" />
      </div>

      {hasFacetFilters ? (
        <div className="mt-3 flex justify-end border-t border-[var(--card-border)] pt-3">
          <button
            type="button"
            onClick={clearFacetFilters}
            disabled={isPending}
            className="text-xs font-medium text-teal-600 hover:underline disabled:opacity-50"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function OrdersFilterBar(props: OrdersFilterBarProps) {
  return (
    <Suspense
      fallback={
        <div className="h-24 animate-pulse rounded-2xl border border-[var(--card-border)] bg-[var(--table-header)]" />
      }
    >
      <OrdersFilterBarInner {...props} />
    </Suspense>
  );
}

/** Redirect to default "this month" range when no dates are in the URL. */
export function useDefaultOrdersDateRange() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) return;

    const def = defaultDateRange();
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", toInputValue(def.from));
    params.set("to", toInputValue(def.to));
    params.set("range", "thisMonth");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);
}
