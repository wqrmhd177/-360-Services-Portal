"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoreVisibilityTables } from "@/lib/analytics/store-visibility";
import { formatNumber, formatPercent } from "@/lib/utils";

function SimpleTable({
  title,
  subtitle,
  columns,
  rows,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        {subtitle ? (
          <p className="text-xs text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="p-0 sm:px-6 sm:pb-6">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-0">
            {emptyMessage}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] mx-4 mb-4 sm:mx-0 sm:mb-0">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="border-b border-[var(--card-border)] bg-[var(--table-header)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={
                        col.align === "right"
                          ? "px-3 py-3 text-right sm:px-4"
                          : "px-3 py-3 sm:px-4"
                      }
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row[columns[0]!.key]}-${index}`}
                    className="border-b border-[var(--card-border)] last:border-0"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={
                          col.align === "right"
                            ? "px-3 py-2.5 text-right tabular-nums whitespace-nowrap sm:px-4"
                            : "px-3 py-2.5 font-medium sm:px-4"
                        }
                      >
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StoreVisibilityTablesSection({
  tables,
  storeId,
}: {
  tables: StoreVisibilityTables;
  storeId?: string;
}) {
  const storeSubtitle = storeId
    ? `Filtered to store ${storeId}`
    : "All stores in current filters";

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <SimpleTable
        title="Products running"
        subtitle={storeSubtitle}
        emptyMessage="No products found for the current filters."
        columns={[
          { key: "product", label: "Product" },
          { key: "orders", label: "Orders", align: "right" },
        ]}
        rows={tables.productOrders.map((row) => ({
          product: row.product,
          orders: formatNumber(row.orders),
        }))}
      />

      <SimpleTable
        title="Confirmation pending — reasons"
        subtitle={storeSubtitle}
        emptyMessage="No confirmation pending orders for the current filters."
        columns={[
          { key: "reason", label: "Reason" },
          { key: "orders", label: "Orders", align: "right" },
        ]}
        rows={tables.confirmationReasons.map((row) => ({
          reason: row.reason,
          orders: formatNumber(row.orders),
        }))}
      />

      <SimpleTable
        title="Product delivery ratio"
        subtitle={storeSubtitle}
        emptyMessage="No product delivery data for the current filters."
        columns={[
          { key: "product", label: "Product" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "delivered", label: "Delivered", align: "right" },
          { key: "deliveryPct", label: "Delivery %", align: "right" },
        ]}
        rows={tables.productDeliveryRatios.map((row) => ({
          product: row.product,
          orders: formatNumber(row.orders),
          delivered: formatNumber(row.delivered),
          deliveryPct: formatPercent(row.deliveryRatio),
        }))}
      />

      <SimpleTable
        title="Undelivered — reasons"
        subtitle={storeSubtitle}
        emptyMessage="No undelivered orders for the current filters."
        columns={[
          { key: "reason", label: "Reason" },
          { key: "orders", label: "Orders", align: "right" },
        ]}
        rows={tables.undeliveredReasons.map((row) => ({
          reason: row.reason,
          orders: formatNumber(row.orders),
        }))}
      />
    </section>
  );
}
