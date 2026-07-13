"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { PieChartCard } from "@/components/charts/pie-chart-card";
import {
  CHART_VARIANT_STYLES,
  type ChartCardVariant,
} from "@/components/charts/chart-card-shell";
import { ChartMiniSparkline } from "@/components/orders/chart-mini-sparkline";
import { CHART_SELECTOR_GRID_CLASS } from "@/components/orders/kpi-card";
import { ChartSelectorCard } from "@/components/orders/chart-selector-card";
import { AccountManagerSelectorCard } from "@/components/orders/account-manager-selector-card";
import { CountryDeliverySelectorCard } from "@/components/orders/country-delivery-selector-card";
import type {
  BreakdownRow,
  CountryDeliveryRow,
  TrendPoint,
} from "@/lib/analytics/orders";
import { cn, formatNumber } from "@/lib/utils";

type PieSlice = { name: string; value: number };
type ChartId = "orders" | "status";

const CHART_META: Record<
  ChartId,
  { title: string; subtitle: string; variant: ChartCardVariant }
> = {
  orders: {
    title: "Orders chart",
    subtitle: "Daily order volume for the selected period",
    variant: "orders",
  },
  status: {
    title: "Status mix",
    subtitle: "Share of orders by fulfillment status",
    variant: "status",
  },
};

function ChartDetailDialog({
  chartId,
  open,
  onClose,
  children,
}: {
  chartId: ChartId;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const meta = CHART_META[chartId];
  const style = CHART_VARIANT_STYLES[meta.variant];
  const Icon = style.icon;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`chart-dialog-title-${chartId}`}
      onClose={onClose}
      className={cn(
        "portal-status-dialog",
        "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-0 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <article
        className={cn(
          "relative flex max-h-[min(90dvh,40rem)] w-full max-w-4xl flex-col overflow-hidden rounded-none border border-[var(--card-border)] bg-gradient-to-br shadow-2xl ring-1 sm:rounded-2xl",
          style.gradient,
          style.ring,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-60 blur-2xl",
            style.iconBg.replace("/15", "/20"),
          )}
          aria-hidden
        />

        <div className="relative flex shrink-0 items-start gap-3 border-b border-white/70 px-5 py-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
              style.iconBg,
            )}
          >
            <Icon className={cn("h-5 w-5", style.iconColor)} strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1">
            <h3
              id={`chart-dialog-title-${chartId}`}
              className="text-sm font-semibold tracking-tight text-[var(--foreground)]"
            >
              {meta.title}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{meta.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Close chart"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)]/70 text-[var(--muted)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {children}
        </div>
      </article>
    </dialog>
  );
}

export function OrdersChartSelector({
  trends,
  pieData,
  totalOrders,
  deliveredRate,
  countryDeliveryRatios,
  accountManagerBreakdown,
  statusBreakdown,
}: {
  trends: TrendPoint[];
  pieData: PieSlice[];
  totalOrders: number;
  deliveredRate: number;
  countryDeliveryRatios: CountryDeliveryRow[];
  accountManagerBreakdown: BreakdownRow[];
  statusBreakdown: BreakdownRow[];
}) {
  const [activeChart, setActiveChart] = useState<ChartId | null>(null);

  const openChart = useCallback((id: ChartId) => {
    setActiveChart((current) => (current === id ? null : id));
  }, []);

  const closeChart = useCallback(() => {
    setActiveChart(null);
  }, []);

  const orderValues = useMemo(
    () => trends.map((point) => Number(point.orders) || 0),
    [trends],
  );

  const ordersAvg = useMemo(() => {
    if (orderValues.length === 0) return 0;
    return orderValues.reduce((sum, value) => sum + value, 0) / orderValues.length;
  }, [orderValues]);

  const sparklineValues = useMemo(() => {
    const slice = orderValues.slice(-14);
    return slice.length >= 2 ? slice : orderValues;
  }, [orderValues]);

  const topStatus = useMemo(() => {
    const sorted = [...statusBreakdown].sort((a, b) => b.orders - a.orders);
    const top = sorted[0];
    if (!top || totalOrders <= 0) return null;
    const pct = (top.orders / totalOrders) * 100;
    return { name: top.name, pct };
  }, [statusBreakdown, totalOrders]);

  return (
    <>
      <section className={CHART_SELECTOR_GRID_CLASS} aria-label="Chart views">
        <AccountManagerSelectorCard
          className="min-h-[10.25rem]"
          rows={accountManagerBreakdown}
          totalOrders={totalOrders}
        />

        <CountryDeliverySelectorCard
          className="min-h-[10.25rem]"
          rows={countryDeliveryRatios}
          overallDeliveryRatio={deliveredRate}
        />

        <ChartSelectorCard
          title="Orders chart"
          variant="orders"
          preview={`Avg ${Math.round(ordersAvg)}`}
          hint="Daily volume"
          active={activeChart === "orders"}
          onClick={() => openChart("orders")}
        >
          <ChartMiniSparkline values={sparklineValues} stroke="#0d9488" />
        </ChartSelectorCard>

        <ChartSelectorCard
          title="Status mix"
          variant="status"
          preview={
            topStatus
              ? `${topStatus.pct.toFixed(0)}%`
              : formatNumber(totalOrders)
          }
          hint={topStatus ? topStatus.name : "No status data"}
          active={activeChart === "status"}
          onClick={() => openChart("status")}
        />
      </section>

      {activeChart === "orders" ? (
        <ChartDetailDialog
          chartId="orders"
          open
          onClose={closeChart}
        >
          <LineChartCard
            embedded
            title="Orders"
            className="h-full w-full min-h-[16rem]"
            data={trends}
            lines={[{ key: "orders", color: "#0d9488", name: "Orders" }]}
            showRevenueInfo={false}
          />
        </ChartDetailDialog>
      ) : null}

      {activeChart === "status" ? (
        <ChartDetailDialog
          chartId="status"
          open
          onClose={closeChart}
        >
          <PieChartCard
            embedded
            wide
            title="Status mix"
            className="w-full"
            data={pieData}
            totalOrders={totalOrders}
          />
        </ChartDetailDialog>
      ) : null}
    </>
  );
}
