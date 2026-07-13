import { KpiCard, KPI_COMPACT_GRID_CLASS } from "@/components/orders/kpi-card";
import { RevenueUsdInfoContent } from "@/components/orders/revenue-usd-info-content";
import { REVENUE_USD_INFO_HEADING } from "@/lib/order-currency/messages";
import type { OrderKPIs } from "@/lib/analytics/orders";
import { formatNumber, formatPercent, formatUsd } from "@/lib/utils";

const revenueInfo = {
  infoTitle: REVENUE_USD_INFO_HEADING,
  infoContent: <RevenueUsdInfoContent />,
};

export function OrdersKpiGrid({
  kpis,
  compact,
}: {
  kpis: OrderKPIs;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section className={KPI_COMPACT_GRID_CLASS}>
        <KpiCard
          compact
          variant="orders"
          title="Orders"
          value={formatNumber(kpis.totalOrders)}
        />
        <KpiCard
          compact
          variant="delivered"
          title="Delivered"
          value={formatPercent(kpis.deliveredRate)}
        />
        <KpiCard
          compact
          variant="return"
          title="Returns"
          value={formatPercent(kpis.returnRate)}
        />
        <KpiCard
          compact
          variant="revenue"
          title="Revenue"
          value={formatUsd(kpis.grossRevenue, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
          {...revenueInfo}
        />
        <KpiCard
          compact
          variant="aov"
          title="AOV"
          value={formatUsd(kpis.aov)}
          {...revenueInfo}
        />
        <KpiCard
          compact
          variant="units"
          title="Units"
          value={formatNumber(kpis.unitsSold)}
        />
        <KpiCard
          compact
          variant="items"
          title="Items/ord"
          value={kpis.avgItemsPerOrder.toFixed(2)}
        />
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <KpiCard
        variant="orders"
        title="Orders"
        value={formatNumber(kpis.totalOrders)}
        subtitle="Unique orders by id"
      />
      <KpiCard
        variant="delivered"
        title="Delivered"
        value={formatPercent(kpis.deliveredRate)}
        subtitle="Of total orders"
      />
      <KpiCard
        variant="return"
        title="Returns"
        value={formatPercent(kpis.returnRate)}
        subtitle="Returns & refunds"
      />
      <KpiCard
        variant="revenue"
        title="Revenue"
        value={formatUsd(kpis.grossRevenue, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
        subtitle="Gross sales in period"
        {...revenueInfo}
      />
      <KpiCard
        variant="aov"
        title="AOV"
        value={formatUsd(kpis.aov)}
        subtitle="Avg order value"
        {...revenueInfo}
      />
      <KpiCard
        variant="units"
        title="Units"
        value={formatNumber(kpis.unitsSold)}
        subtitle="Line item quantity"
      />
      <KpiCard
        variant="items"
        title="Items/ord"
        value={kpis.avgItemsPerOrder.toFixed(2)}
        subtitle="Avg units per order"
      />
    </section>
  );
}
