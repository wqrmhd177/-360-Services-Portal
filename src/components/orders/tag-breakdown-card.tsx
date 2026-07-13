"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCardShell } from "@/components/charts/chart-card-shell";
import { BreakdownMetricList } from "@/components/orders/breakdown-metric-list";
import { RevenueUsdInfoContent } from "@/components/orders/revenue-usd-info-content";
import type { BreakdownRow } from "@/lib/analytics/orders";
import { STATUS_COLOR_PALETTE } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

function tagColor(_name: string, index: number) {
  return STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length];
}

export function TagBreakdownCard({
  rows,
  limit = 15,
}: {
  rows: BreakdownRow[];
  limit?: number;
}) {
  const displayRows = useMemo(
    () => [...rows].sort((a, b) => b.orders - a.orders).slice(0, limit),
    [rows, limit],
  );

  const chartData = useMemo(
    () => displayRows.map((row) => ({ ...row, label: row.name })),
    [displayRows],
  );

  const chartHeight = Math.max(200, Math.min(320, chartData.length * 32 + 32));

  return (
    <ChartCardShell
      title="Tag breakdown"
      variant="bar"
      infoContent={<RevenueUsdInfoContent />}
      contentClassName="gap-5"
    >
      <p className="-mt-2 text-xs text-[var(--muted)]">
        Top {limit} order tags by volume in the selected period
      </p>

      {displayRows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">
          No tag data for the current filters.
        </p>
      ) : (
        <>
          <div className="w-full min-w-0" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 4, right: 48, top: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Tooltip
                  cursor={false}
                  formatter={(value) => [formatNumber(Number(value)), "Orders"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="orders" radius={[0, 4, 4, 0]} activeBar={false}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={tagColor(chartData[index].name, index)}
                      fillOpacity={0.9 - index * 0.03}
                    />
                  ))}
                  <LabelList
                    dataKey="orders"
                    position="right"
                    formatter={(value) => formatNumber(Number(value))}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      fill: "#475569",
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <BreakdownMetricList rows={displayRows} colorForName={tagColor} />
        </>
      )}
    </ChartCardShell>
  );
}
