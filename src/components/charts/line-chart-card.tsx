"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ChartCardShell } from "@/components/charts/chart-card-shell";
import { RevenueUsdInfoContent } from "@/components/orders/revenue-usd-info-content";
import type { TrendPoint } from "@/lib/analytics/orders";
import { useChartTheme } from "@/lib/theme/chart-theme";

function formatPointLabel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function LineChartCard({
  title,
  data,
  lines,
  showRevenueInfo,
  showPointLabels = true,
  embedded = false,
  className,
}: {
  title: string;
  data: TrendPoint[];
  lines: { key: string; color: string; name: string }[];
  showRevenueInfo?: boolean;
  showPointLabels?: boolean;
  embedded?: boolean;
  className?: string;
}) {
  const hasRevenueLine = lines.some((l) => l.key === "revenue");
  const showInfo = showRevenueInfo ?? hasRevenueLine;

  const chartTheme = useChartTheme();
  const primaryKey = lines[0]?.key ?? "orders";
  const primaryAvg = useMemo(() => {
    const values = data.map((d) => Number(d[primaryKey as keyof TrendPoint]) || 0);
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }, [data, primaryKey]);

  return (
    <ChartCardShell
      title={title}
      variant={hasRevenueLine ? "revenue" : "orders"}
      embedded={embedded}
      className={className}
      infoContent={showInfo ? <RevenueUsdInfoContent /> : undefined}
    >
      <div className="h-[220px] w-full min-w-0 sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={220}>
          <AreaChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: chartTheme.tickFill }}
              tickLine={false}
              axisLine={{ stroke: chartTheme.axisStroke }}
              tickFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d");
                } catch {
                  return String(v);
                }
              }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: chartTheme.tickFill }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${chartTheme.tooltipBorder}`,
                backgroundColor: chartTheme.tooltipBg,
                color: chartTheme.labelFill,
                fontSize: 12,
              }}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "PP");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value) => [
                formatPointLabel(value) || "0",
                undefined,
              ]}
            />

            {primaryAvg > 0 ? (
              <ReferenceLine
                y={primaryAvg}
                stroke={chartTheme.referenceStroke}
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Avg ${Math.round(primaryAvg)}`,
                  position: "insideTopRight",
                  fill: chartTheme.tickFill,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            ) : null}

            {lines.map((line) => (
              <Area
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                fill={line.color}
                fillOpacity={0.12}
                dot={{
                  r: 3,
                  fill: line.color,
                  strokeWidth: 0,
                }}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: chartTheme.activeDotStroke,
                }}
              >
                {showPointLabels ? (
                  <LabelList
                    dataKey={line.key}
                    position="top"
                    offset={10}
                    formatter={formatPointLabel}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      fill: chartTheme.labelFill,
                    }}
                  />
                ) : null}
              </Area>
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCardShell>
  );
}
