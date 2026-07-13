"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { CollapsibleChartPanel } from "@/components/charts/collapsible-chart-panel";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { PieChartCard } from "@/components/charts/pie-chart-card";
import type { TrendPoint } from "@/lib/analytics/orders";
import { migrateLegacyChartPanelStorage } from "@/lib/charts/panel-storage";

type PieSlice = { name: string; value: number };

/** Stable localStorage prefix per route (e.g. orders, orders-stores, orders-status). */
function chartStoragePrefix(pathname: string) {
  const slug = pathname.replace(/^\/+/, "").replace(/\//g, "-");
  return slug || "orders";
}

export function OrdersCollapsibleCharts({
  trends,
  pieData,
  totalOrders,
}: {
  trends: TrendPoint[];
  pieData: PieSlice[];
  totalOrders: number;
}) {
  const pathname = usePathname();
  const prefix = useMemo(() => chartStoragePrefix(pathname), [pathname]);

  useEffect(() => {
    migrateLegacyChartPanelStorage();
  }, []);

  return (
    <div className="space-y-4">
      <section className="grid items-stretch gap-4 lg:grid-cols-3">
        <CollapsibleChartPanel
          key={`${prefix}-orders-chart`}
          className="lg:col-span-2"
          title="Orders chart"
          subtitle="Daily order volume for the selected period"
          variant="orders"
          storageKey={`${prefix}-orders-chart`}
        >
          <LineChartCard
            embedded
            title="Orders"
            className="h-full w-full"
            data={trends}
            lines={[{ key: "orders", color: "#0d9488", name: "Orders" }]}
            showRevenueInfo={false}
          />
        </CollapsibleChartPanel>

        <CollapsibleChartPanel
          key={`${prefix}-status-mix`}
          title="Status mix"
          subtitle="Share of orders by fulfillment status"
          variant="status"
          storageKey={`${prefix}-status-mix`}
        >
          <PieChartCard
            embedded
            title="Status mix"
            className="h-full w-full"
            data={pieData}
            totalOrders={totalOrders}
          />
        </CollapsibleChartPanel>
      </section>
    </div>
  );
}
