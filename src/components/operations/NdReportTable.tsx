"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NdSkuDetailsDialog } from "@/components/operations/NdSkuDetailsDialog";
import type { NdSkuSummaryRow } from "@/lib/operations/ndReport";
import { formatPortalYmdMedium } from "@/lib/portalTimezone";
import { formatNumber } from "@/lib/utils";

function formatNdDate(value: string | null): string {
  if (!value) return "—";
  const ymd = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return formatPortalYmdMedium(ymd);
  }
  return value;
}

export function NdReportTable({
  rows,
  filterQuery,
}: {
  rows: NdSkuSummaryRow[];
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

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--muted)]">
          No ND SKUs found for the selected filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="-mx-3 overflow-x-auto p-0 px-3 sm:mx-0 sm:px-0">
          <table className="w-full text-xs sm:text-sm">
            <thead className="border-b bg-[var(--table-header)] text-[10px] uppercase text-[var(--muted)] sm:text-xs">
              <tr>
                <th className="px-2 py-2 text-left sm:px-3">Bifurcation</th>
                <th className="px-2 py-2 text-left sm:px-3">Purchase Type</th>
                <th className="px-2 py-2 text-left sm:px-3">Product Title</th>
                <th className="px-2 py-2 text-left sm:px-3">SKU</th>
                <th className="px-2 py-2 text-left sm:px-3">ND Date</th>
                <th className="px-2 py-2 text-right sm:px-3">ND Qty</th>
                <th className="px-2 py-2 text-right sm:px-3">PO Qty</th>
                <th className="px-2 py-2 text-right sm:px-3">Movement Qty</th>
                <th className="w-20 px-2 py-2 text-center sm:px-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-[var(--card-border)]">
                  <td className="px-2 py-1.5 text-[var(--muted)] sm:px-3">
                    {row.bifurcation?.trim() || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-[var(--muted)] sm:px-3">
                    {row.fulfilment_route?.trim() || "—"}
                  </td>
                  <td
                    className="max-w-[180px] truncate px-2 py-1.5 font-medium sm:px-3"
                    title={row.title}
                  >
                    {row.title}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] sm:px-3 sm:text-xs">
                    {row.sku}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 sm:px-3">
                    {formatNdDate(row.min_nd_date)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold sm:px-3">
                    {formatNumber(row.nd_quantity)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums sm:px-3">
                    {formatNumber(row.po_qty)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums sm:px-3">
                    {formatNumber(row.movement_qty)}
                  </td>
                  <td className="px-2 py-1.5 text-center sm:px-3">
                    <button
                      type="button"
                      onClick={() => openDetails(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-medium hover:bg-[var(--table-header)] sm:px-2.5 sm:py-1 sm:text-xs"
                    >
                      View
                      <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
