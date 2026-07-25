"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";
import { cn } from "@/lib/utils";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
}

interface SkuPerformanceFilterBarProps {
  options: FilterOptions;
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

function SkuPerformanceFilterBarInner({ options }: SkuPerformanceFilterBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [country, setCountry] = useState(searchParams.get("country") ?? "");
  const [bifurcation, setBifurcation] = useState(searchParams.get("bifurcation") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    setCountry(searchParams.get("country") ?? "");
    setBifurcation(searchParams.get("bifurcation") ?? "");
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (country) params.set("country", country);
    else params.delete("country");
    if (bifurcation) params.set("bifurcation", bifurcation);
    else params.delete("bifurcation");
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [bifurcation, country, pathname, router, search, searchParams]);

  const resetFilters = useCallback(() => {
    const def = defaultDateRange();
    const params = new URLSearchParams();
    params.set("from", toInputValue(def.from));
    params.set("to", toInputValue(def.to));
    params.set("range", "thisMonth");
    setCountry("");
    setBifurcation("");
    setSearch("");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router]);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <FilterSelect
          label="Country"
          value={country}
          disabled={isPending}
          onChange={setCountry}
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
          onChange={setBifurcation}
        >
          <option value="">All bifurcations</option>
          {options.bifurcations.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </FilterSelect>

        <DateRangePicker layout="stacked" className="min-w-0" />

        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Search SKU / Product
          </span>
          <input
            type="search"
            value={search}
            disabled={isPending}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            placeholder="Search SKU or product name"
            className={cn(
              "h-10 w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--foreground)] shadow-sm",
              "transition-colors hover:border-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--card-border)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t border-[var(--card-border)] pt-3">
        <button
          type="button"
          onClick={resetFilters}
          disabled={isPending}
          className="btn-secondary mr-2 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={applyFilters}
          disabled={isPending}
          className="btn-primary disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export default function SkuPerformanceFilterBar(props: SkuPerformanceFilterBarProps) {
  return (
    <Suspense
      fallback={
        <div className="h-28 animate-pulse rounded-2xl border border-[var(--card-border)] bg-[var(--table-header)]" />
      }
    >
      <SkuPerformanceFilterBarInner {...props} />
    </Suspense>
  );
}

export function useDefaultSkuPerformanceDateRange() {
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
