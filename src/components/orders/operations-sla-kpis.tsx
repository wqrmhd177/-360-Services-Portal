"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { KpiCard, KPI_COMPACT_GRID_5_CLASS } from "@/components/orders/kpi-card";
import type {
  CountrySlaRow,
  FulfillmentSLA,
  FulfillmentSlaMetric,
} from "@/lib/analytics/orders";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

type SlaKpiConfig = {
  metric: FulfillmentSlaMetric;
  title: string;
  value: string;
  variant?: "orders" | "delivered" | "return" | "items";
};

function formatCountryValue(metric: FulfillmentSlaMetric, value: number | null) {
  if (value == null) return "—";
  if (metric === "shipped48h") return formatPercent(value);
  return `${value.toFixed(1)} days`;
}

function OperationsSlaCountryDialog({
  title,
  metric,
  rows,
  rangeLabel,
  open,
  onClose,
}: {
  title: string;
  metric: FulfillmentSlaMetric;
  rows: CountrySlaRow[];
  rangeLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isPercent = metric === "shipped48h";

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
      aria-labelledby="sla-country-detail-title"
      onClose={onClose}
      className={cn(
        "portal-status-dialog",
        "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-4 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="relative flex max-h-[min(85vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-teal-500/15 blur-2xl" />

        <div className="relative flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="sla-country-detail-title"
              className="text-base font-semibold tracking-tight text-[var(--foreground)]"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              By country · {rangeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] shadow-sm transition-colors hover:bg-[var(--table-header)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
              No country data for this metric in the selected range.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-[var(--table-header)] text-left text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3">Country</th>
                  <th className="px-5 py-3">
                    {isPercent ? "Within 48h" : "Avg days"}
                  </th>
                  <th className="px-5 py-3">Orders</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.country}
                    className="border-b border-[var(--card-border)] last:border-0"
                  >
                    <td className="px-5 py-2.5 font-medium">{row.country}</td>
                    <td className="px-5 py-2.5 tabular-nums">
                      {formatCountryValue(metric, row.value)}
                    </td>
                    <td className="px-5 py-2.5 tabular-nums text-[var(--muted)]">
                      {formatNumber(row.sampleCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
    </dialog>
  );
}

export function OperationsSlaKpis({
  sla,
  rangeLabel,
}: {
  sla: FulfillmentSLA;
  rangeLabel: string;
}) {
  const [activeMetric, setActiveMetric] = useState<FulfillmentSlaMetric | null>(
    null,
  );

  const kpis: SlaKpiConfig[] = [
    {
      metric: "confirm",
      title: "Avg order → confirm",
      value:
        sla.avgOrderToConfirmDays != null
          ? `${sla.avgOrderToConfirmDays.toFixed(1)} days`
          : "—",
    },
    {
      metric: "ship",
      title: "Avg order → ship",
      value:
        sla.avgOrderToShipDays != null
          ? `${sla.avgOrderToShipDays.toFixed(1)} days`
          : "—",
      variant: "delivered",
    },
    {
      metric: "deliver",
      title: "Avg order → deliver",
      value:
        sla.avgOrderToDeliverDays != null
          ? `${sla.avgOrderToDeliverDays.toFixed(1)} days`
          : "—",
      variant: "delivered",
    },
    {
      metric: "return",
      title: "Avg order → return",
      value:
        sla.avgOrderToReturnDays != null
          ? `${sla.avgOrderToReturnDays.toFixed(1)} days`
          : "—",
      variant: "return",
    },
    {
      metric: "shipped48h",
      title: "Shipped within 48h",
      value: formatPercent(sla.shippedWithin48hPct),
      variant: "items",
    },
  ];

  const activeKpi = kpis.find((k) => k.metric === activeMetric);

  return (
    <>
      <section className={KPI_COMPACT_GRID_5_CLASS}>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.metric}
            compact
            title={kpi.title}
            value={kpi.value}
            variant={kpi.variant}
            onClick={() => setActiveMetric(kpi.metric)}
          />
        ))}
      </section>

      <OperationsSlaCountryDialog
        title={activeKpi?.title ?? ""}
        metric={activeMetric ?? "confirm"}
        rows={activeMetric ? sla.byCountry[activeMetric] : []}
        rangeLabel={rangeLabel}
        open={activeMetric != null}
        onClose={() => setActiveMetric(null)}
      />
    </>
  );
}
