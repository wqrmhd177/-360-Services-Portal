"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartCardShell } from "@/components/charts/chart-card-shell";
import { BreakdownMetricList } from "@/components/orders/breakdown-metric-list";
import { RevenueUsdInfoContent } from "@/components/orders/revenue-usd-info-content";
import { StatusDetailDialog } from "@/components/orders/status-detail-dialog";
import type { BreakdownRow } from "@/lib/analytics/orders";
import { statusColor } from "@/lib/constants";
import { cn } from "@/lib/utils";

function StatusSliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: readonly { name?: string | number; value?: unknown }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const name = String(item?.name ?? "");
  const value = Number(item?.value ?? 0);
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)]/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold text-[var(--foreground)]">{name}</p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        {value.toLocaleString()} orders · {pct.toFixed(1)}%
      </p>
    </div>
  );
}

export function StatusBreakdownCard({
  rows,
  totalOrders,
}: {
  rows: BreakdownRow[];
  totalOrders: number;
}) {
  const pieData = useMemo(
    () =>
      [...rows]
        .filter((row) => row.orders > 0)
        .map((row) => ({ name: row.name, value: row.orders }))
        .sort((a, b) => b.value - a.value),
    [rows],
  );

  const sliceSum = useMemo(
    () => pieData.reduce((sum, slice) => sum + slice.value, 0),
    [pieData],
  );

  const total = totalOrders > 0 ? totalOrders : sliceSum;

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const dialogOpen = selectedStatus !== null;

  const openStatusDetail = useCallback((row: BreakdownRow) => {
    setSelectedStatus(row.name);
  }, []);

  const closeStatusDetail = useCallback(() => {
    setSelectedStatus(null);
  }, []);

  const handlePieClick = useCallback(
    (sector: { name?: string | number }) => {
      const name = sector?.name != null ? String(sector.name) : "";
      if (name) setSelectedStatus(name);
    },
    [],
  );

  return (
    <>
      <ChartCardShell
      title="Status breakdown"
      variant="status"
      infoContent={<RevenueUsdInfoContent />}
      contentClassName="gap-5"
    >
      <p className="-mt-2 text-xs text-[var(--muted)]">
        Share of filtered orders by fulfillment status
      </p>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="relative mx-auto h-48 w-full max-w-[220px] shrink-0 lg:mx-0">
          {pieData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--card)]/40 text-sm text-[var(--muted)]">
              No status data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive
                  className="cursor-pointer outline-none"
                  onClick={handlePieClick}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={statusColor(entry.name, index)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <StatusSliceTooltip
                      active={active}
                      payload={payload}
                      total={total}
                    />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {pieData.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">
                {total.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                orders
              </span>
            </div>
          ) : null}
        </div>

        <div className={cn("min-w-0 flex-1")}>
          <BreakdownMetricList
            rows={rows}
            colorForName={statusColor}
            onRowClick={openStatusDetail}
          />
        </div>
      </div>
      </ChartCardShell>

      <StatusDetailDialog
        statusName={selectedStatus}
        open={dialogOpen}
        onClose={closeStatusDetail}
      />
    </>
  );
}
