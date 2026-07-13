import { OrdersChartSelector } from "@/components/orders/orders-chart-selector";
import { OrdersKpiGrid } from "@/components/orders/orders-kpi-grid";
import type { getStoresAnalytics } from "@/lib/orders/data";

type OrdersOverviewData = Awaited<ReturnType<typeof getStoresAnalytics>>;

export function OrdersOverviewSection({
  data,
  compactKpis,
}: {
  data: OrdersOverviewData;
  compactKpis?: boolean;
}) {
  const {
    kpis,
    trends,
    statusBreakdown,
    countryDeliveryRatios,
    accountManagerBreakdown,
  } = data;

  const pieData = statusBreakdown.map((s) => ({
    name: s.name,
    value: s.orders,
  }));

  return (
    <>
      <OrdersKpiGrid kpis={kpis} compact={compactKpis} />

      <OrdersChartSelector
        trends={trends}
        pieData={pieData}
        totalOrders={kpis.totalOrders}
        deliveredRate={kpis.deliveredRate}
        countryDeliveryRatios={countryDeliveryRatios}
        accountManagerBreakdown={accountManagerBreakdown}
        statusBreakdown={statusBreakdown}
      />
    </>
  );
}
