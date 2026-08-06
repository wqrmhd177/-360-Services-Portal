"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/layout/date-range-picker";
import { FilterMultiSelect } from "@/components/operations/FilterMultiSelect";
import {
  dedupeCountryFilterOptions,
  normalizeCountryFilterParam,
} from "@/lib/country-normalization";
import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";
import { cn } from "@/lib/utils";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
}

function parseListParam(value: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function serializeList(values: string[]): string {
  return values.join(",");
}

function NdReportFilterBarInner({ options }: { options: FilterOptions }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [countries, setCountries] = useState<string[]>(
    parseListParam(searchParams.get("country")),
  );
  const [bifurcations, setBifurcations] = useState<string[]>(
    parseListParam(searchParams.get("bifurcation")),
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const countryOptions = useMemo(
    () => dedupeCountryFilterOptions(options.countries),
    [options.countries],
  );

  useEffect(() => {
    setCountries(parseListParam(searchParams.get("country")));
    setBifurcations(parseListParam(searchParams.get("bifurcation")));
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const canonicalCountries = countries
      .map((c) => normalizeCountryFilterParam(c) ?? c)
      .filter(Boolean);
    const countryValue = serializeList(canonicalCountries);
    const bifurcationValue = serializeList(bifurcations);

    if (countryValue) params.set("country", countryValue);
    else params.delete("country");
    if (bifurcationValue) params.set("bifurcation", bifurcationValue);
    else params.delete("bifurcation");
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [bifurcations, countries, pathname, router, search, searchParams]);

  const resetFilters = useCallback(() => {
    const def = defaultDateRange();
    const params = new URLSearchParams();
    params.set("from", toInputValue(def.from));
    params.set("to", toInputValue(def.to));
    setCountries([]);
    setBifurcations([]);
    setSearch("");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router]);

  return (
    <div className="flex flex-wrap items-end gap-2 lg:flex-nowrap lg:gap-3">
        <div className="min-w-[10rem] flex-1">
          <FilterMultiSelect
            label="Country"
            options={countryOptions}
            selected={countries}
            onChange={setCountries}
            disabled={isPending}
            allLabel="All countries"
          />
        </div>

        <div className="min-w-[10rem] flex-1">
          <FilterMultiSelect
            label="Bifurcation"
            options={options.bifurcations}
            selected={bifurcations}
            onChange={setBifurcations}
            disabled={isPending}
            allLabel="All bifurcations"
          />
        </div>

        <div className="min-w-[10rem] flex-1">
          <DateRangePicker layout="inline" className="min-w-0 [&_button]:h-10" />
        </div>

        <label className="block min-w-[10rem] flex-1">
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

        <div className="flex shrink-0 items-end gap-2 pb-0.5">
          <button
            type="button"
            onClick={resetFilters}
            disabled={isPending}
            className="btn-secondary h-10 px-4 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={applyFilters}
            disabled={isPending}
            className="btn-primary h-10 px-4 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
  );
}

export default function NdReportFilterBar(props: { options: FilterOptions }) {
  return (
    <Suspense
      fallback={
        <div className="h-16 animate-pulse rounded-2xl border border-[var(--card-border)] bg-[var(--table-header)]" />
      }
    >
      <NdReportFilterBarInner {...props} />
    </Suspense>
  );
}
