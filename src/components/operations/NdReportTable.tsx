"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, KPI_COMPACT_GRID_CLASS } from "@/components/orders/kpi-card";
import { NdSkuDetailsDialog } from "@/components/operations/NdSkuDetailsDialog";
import type { NdReportTotals, NdSkuSummaryRow } from "@/lib/operations/ndReport";
import { formatNumber } from "@/lib/utils";

export function NdReportTable({
  rows,
  totals,
  filterQuery,
}: {
  rows: NdSkuSummaryRow[];
  totals: NdReportTotals;
  filterQuery: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<NdSkuSummaryRow | null>(null);

  useEffect(() => {
    setDialogOpen(false);
    setSelectedRow(null);
  }, [filterQuery]);

  const rowKey = (row: NdSkuSummaryRow) =>
    `${row.country}\0${row.bifurcation}\0${row.sku}`;

  const openDetails = (row: NdSkuSummaryRow) => {
    setSelectedRow(row);
    setDialogOpen(true);
  };

  return (
    <>
      <div className={KPI_COMPACT_GRID_CLASS}>
        <KpiCard compact title="ND SKUs" value={formatNumber(totals.nd_skus)} variant="items" />
        <KpiCard compact title="ND Orders" value={formatNumber(totals.nd_orders)} variant="orders" />
        <KpiCard compact title="ND Quantity" value={formatNumber(totals.nd_quantity)} variant="units" />
        <KpiCard
          compact
          title="Affected Stores"
          value={formatNumber(totals.affected_stores)}
          variant="delivered"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted)]">
            No ND SKUs found for the selected filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>ND SKUs</CardTitle>
          </CardHeader>
          <CardContent className="-mx-3 overflow-x-auto p-0 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-[var(--table-header)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-3 text-left">Route</th>
                  <th className="px-3 py-3 text-left">Product Title</th>
                  <th className="px-3 py-3 text-left">SKU</th>
                  <th className="px-3 py-3 text-right">ND Orders</th>
                  <th className="px-3 py-3 text-right">ND Qty</th>
                  <th className="px-3 py-3 text-right">Stores</th>
                  <th className="px-3 py-3 text-center">Suggestions</th>
                  <th className="w-24 px-3 py-3 text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-[var(--card-border)]">
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {row.fulfilment_route?.trim() || "—"}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-3 py-2 font-medium"
                      title={row.title}
                    >
                      {row.title}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(row.nd_orders)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatNumber(row.nd_quantity)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(row.store_count)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {row.suggestion_count > 0
                        ? `${row.suggestion_count} Suggestion${row.suggestion_count === 1 ? "" : "s"}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openDetails(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--table-header)]"
                      >
                        View
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <NdSkuDetailsDialog
        row={selectedRow}
        filterQuery={filterQuery}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedRow(null);
        }}
      />
    </>
  );
}
