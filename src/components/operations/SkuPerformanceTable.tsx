"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuStoreBreakdownDialog } from "@/components/operations/SkuStoreBreakdownDialog";
import type { SkuPerformanceRow } from "@/lib/operations/skuPerformance";
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

export function SkuPerformanceTable({
  rows,
  filterQuery,
}: {
  rows: SkuPerformanceRow[];
  filterQuery: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SkuPerformanceRow | null>(null);

  useEffect(() => {
    setDialogOpen(false);
    setSelectedRow(null);
  }, [filterQuery]);

  const openStoresDialog = (row: SkuPerformanceRow) => {
    setSelectedRow(row);
    setDialogOpen(true);
  };

  const closeStoresDialog = () => {
    setDialogOpen(false);
    setSelectedRow(null);
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
    <>
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
                <th className="px-4 py-3" title="Status Approved only — not yet dispatched">
                  Approved Qty
                </th>
                <th className="px-4 py-3" title="Delivered ÷ Dispatched">
                  D → D %
                </th>
                <th
                  className="px-4 py-3"
                  title="Avg daily dispatched units per calendar day (zero-dispatch days excluded)"
                >
                  Wtd. Avg
                </th>
                <th className="px-4 py-3">Inventory</th>
                <th className="w-12 px-4 py-3" aria-label="View stores" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sku} className="border-b">
                  <td
                    className="max-w-[220px] truncate px-4 py-2 font-medium"
                    title={row.product_title}
                  >
                    {row.product_title}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatNumber(row.approved_quantity)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatPct(row.dispatch_to_delivery_pct)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {formatWa(row.weighted_average)}
                  </td>
                  <td
                    className="px-4 py-2 tabular-nums"
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
                      onClick={() => openStoresDialog(row)}
                      aria-label={`View stores for ${row.sku}`}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md border border-[var(--card-border)] text-[var(--muted)] transition-colors hover:bg-[var(--table-header)] hover:text-[var(--foreground)]",
                        selectedRow?.sku === row.sku &&
                          dialogOpen &&
                          "bg-[var(--table-header)] text-[var(--foreground)]",
                      )}
                    >
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SkuStoreBreakdownDialog
        row={selectedRow}
        filterQuery={filterQuery}
        open={dialogOpen}
        onClose={closeStoresDialog}
      />
    </>
  );
}
