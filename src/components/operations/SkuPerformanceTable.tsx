"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkuPerformanceRow, SkuSellerRow } from "@/lib/operations/skuPerformance";
import { cn, formatNumber, formatOneDecimal } from "@/lib/utils";

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatWa(value: number | null): string {
  if (value == null) return "—";
  return formatOneDecimal(value);
}

function formatInventory(value: number | null): string {
  if (value == null) return "—";
  return formatNumber(value);
}

function SellerDetailSection({
  sku,
  filterQuery,
}: {
  sku: string;
  filterQuery: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SkuSellerRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/operations/sku-performance/${encodeURIComponent(sku)}/sellers?${filterQuery}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load sellers");
      setRows(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sellers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterQuery, sku]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <tr>
        <td colSpan={7} className="bg-[var(--table-header)]/40 px-4 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading seller details…
          </div>
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr>
        <td colSpan={7} className="bg-red-50 px-4 py-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
          <button type="button" onClick={load} className="ml-3 underline">
            Retry
          </button>
        </td>
      </tr>
    );
  }

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="bg-[var(--table-header)]/40 px-4 py-4 text-sm text-[var(--muted)]">
          No seller breakdown for this SKU.
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="bg-[var(--table-header)]/60">
        <td colSpan={7} className="px-4 py-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">User ID</th>
                <th className="px-3 py-2">Store ID</th>
                <th className="px-3 py-2">Store Name</th>
                <th className="px-3 py-2">Approved Qty</th>
                <th className="px-3 py-2">D → D %</th>
                <th className="px-3 py-2">Wtd. Avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.store_id}-${row.user_id ?? "na"}`} className="border-t border-[var(--card-border)]">
                  <td className="px-3 py-2">{row.user_id ?? "—"}</td>
                  <td className="px-3 py-2">{row.store_id || "—"}</td>
                  <td className="px-3 py-2">{row.store_name ?? "—"}</td>
                  <td className="px-3 py-2">{formatNumber(row.approved_quantity)}</td>
                  <td className="px-3 py-2">{formatPct(row.dispatch_to_delivery_pct)}</td>
                  <td className="px-3 py-2">{formatWa(row.weighted_average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </td>
      </tr>
    </>
  );
}

export function SkuPerformanceTable({
  rows,
  filterQuery,
}: {
  rows: SkuPerformanceRow[];
  filterQuery: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpanded(new Set());
  }, [filterQuery]);

  const toggle = (sku: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--muted)]">
          No SKUs found for the selected filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SKU Performance</CardTitle>
      </CardHeader>
      <CardContent className="-mx-3 overflow-x-auto p-0 px-3 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-[var(--table-header)] text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Product Title</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3" title="Item quantity for orders past confirmation (excludes Confirmation Pending and Cancelled)">
                Approved Qty
              </th>
              <th className="px-4 py-3" title="Delivered ÷ Dispatched">
                D → D %
              </th>
              <th className="px-4 py-3" title="Avg daily dispatched units (zero-dispatch days excluded)">
                Wtd. Avg
              </th>
              <th className="px-4 py-3">Inventory</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.sku);
              return (
                <Fragment key={row.sku}>
                  <tr className="border-b">
                    <td className="max-w-[220px] truncate px-4 py-2 font-medium" title={row.product_title}>
                      {row.product_title}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-4 py-2">{formatNumber(row.approved_quantity)}</td>
                    <td className="px-4 py-2">{formatPct(row.dispatch_to_delivery_pct)}</td>
                    <td className="px-4 py-2">{formatWa(row.weighted_average)}</td>
                    <td
                      className="px-4 py-2"
                      title={
                        row.available_inventory == null
                          ? "Inventory data temporarily unavailable"
                          : undefined
                      }
                    >
                      {formatInventory(row.available_inventory)}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(row.sku)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? "Collapse seller details" : "Expand seller details"}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md border border-[var(--card-border)] text-[var(--muted)] transition-transform hover:bg-[var(--table-header)]",
                          isOpen && "rotate-180",
                        )}
                      >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <SellerDetailSection sku={row.sku} filterQuery={filterQuery} />
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
