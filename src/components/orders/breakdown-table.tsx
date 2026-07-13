import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCardHeader } from "@/components/orders/chart-card-header";
import { RevenueUsdInfoContent } from "@/components/orders/revenue-usd-info-content";
import { REVENUE_USD_INFO_HEADING } from "@/lib/order-currency/messages";
import { formatNumber, formatPercent, formatUsd } from "@/lib/utils";
import type { BreakdownRow, TitleBreakdownRow } from "@/lib/analytics/orders";

function deliveryRatioForRow(row: BreakdownRow): number {
  return (row as TitleBreakdownRow).deliveryRatio ?? 0;
}

export function BreakdownTable({
  title,
  rows,
  showRevenueInfo = true,
  showRevenueColumn = true,
  showDeliveryColumn = false,
  showStatusColumn,
}: {
  title: string;
  rows: BreakdownRow[];
  showRevenueInfo?: boolean;
  showRevenueColumn?: boolean;
  showDeliveryColumn?: boolean;
  showStatusColumn?: boolean;
}) {
  const withStatus =
    showStatusColumn ?? rows.some((row) => row.status != null && row.status !== "");
  return (
    <Card>
      {showRevenueInfo ? (
        <ChartCardHeader
          title={title}
          showRevenueInfo
          infoTitle={REVENUE_USD_INFO_HEADING}
          infoContent={<RevenueUsdInfoContent />}
        />
      ) : (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="-mx-3 overflow-x-auto p-0 px-3 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-[var(--table-header)] text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              {withStatus ? (
                <th className="px-4 py-3">Status</th>
              ) : null}
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Orders</th>
              {showRevenueColumn ? (
                <th className="px-4 py-3">Revenue (USD)</th>
              ) : null}
              {showDeliveryColumn ? (
                <th className="px-4 py-3">Delivery %</th>
              ) : null}
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={withStatus ? `${row.status ?? ""}-${row.name}` : row.name}
                className="border-b last:border-0"
              >
                {withStatus ? (
                  <td className="px-4 py-2 text-[var(--muted)]">
                    {row.status ?? "—"}
                  </td>
                ) : null}
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2">{formatNumber(row.orders)}</td>
                {showRevenueColumn ? (
                  <td className="px-4 py-2">{formatUsd(row.revenue)}</td>
                ) : null}
                {showDeliveryColumn ? (
                  <td className="px-4 py-2">
                    {formatPercent(deliveryRatioForRow(row))}
                  </td>
                ) : null}
                <td className="px-4 py-2">{formatNumber(row.units)}</td>
                <td className="px-4 py-2">{formatPercent(row.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
