"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
  storeIds?: number[];
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

export default function OrdersFilterBar({
  options,
  country,
  bifurcation,
  from,
  to,
  storeId = "",
  showStoreFilter = false,
}: OrdersFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (updates: Record<string, string>) => {
      const sp = new URLSearchParams({
        country,
        bifurcation,
        from,
        to,
        ...(showStoreFilter ? { store_id: storeId } : {}),
        ...updates,
      });
      for (const [k, v] of [...sp.entries()]) {
        if (!v) sp.delete(k);
      }
      startTransition(() => router.push(`${pathname}?${sp.toString()}`));
    },
    [router, pathname, country, bifurcation, from, to, storeId, showStoreFilter]
  );

  const clearAll = () => {
    startTransition(() => router.push(pathname));
  };

  const hasFilters = !!(country || bifurcation || from || to || (showStoreFilter && storeId));

  const labelCls = "block text-xs font-medium text-gray-500 mb-1";
  const selectCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition disabled:opacity-50";
  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition disabled:opacity-50";

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`grid gap-3 ${showStoreFilter ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4"}`}>
        <div>
          <label className={labelCls}>Country</label>
          <select
            className={selectCls}
            value={country}
            disabled={isPending}
            onChange={(e) => push({ country: e.target.value })}
          >
            <option value="">All Countries</option>
            {options.countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Bifurcation</label>
          <select
            className={selectCls}
            value={bifurcation}
            disabled={isPending}
            onChange={(e) => push({ bifurcation: e.target.value })}
          >
            <option value="">All Bifurcations</option>
            {options.bifurcations.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {showStoreFilter && (
          <div>
            <label className={labelCls}>Store ID</label>
            <select
              className={selectCls}
              value={storeId}
              disabled={isPending}
              onChange={(e) => push({ store_id: e.target.value })}
            >
              <option value="">All Stores</option>
              {(options.storeIds ?? []).map((s) => (
                <option key={s} value={String(s)}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>From Date</label>
          <input
            type="date"
            className={inputCls}
            value={from}
            disabled={isPending}
            onChange={(e) => push({ from: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>To Date</label>
          <input
            type="date"
            className={inputCls}
            value={to}
            disabled={isPending}
            onChange={(e) => push({ to: e.target.value })}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={clearAll}
            disabled={isPending}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
