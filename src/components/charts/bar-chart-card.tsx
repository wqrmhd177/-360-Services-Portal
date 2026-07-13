"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCardShell } from "@/components/charts/chart-card-shell";
import { RevenueUsdInfoContent } from "@/components/orders/revenue-usd-info-content";
import { useChartTheme } from "@/lib/theme/chart-theme";
import { formatNumber, formatUsd } from "@/lib/utils";

function formatBarDataLabel(
  value: unknown,
  dataKey: "orders" | "revenue" | "units",
) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (dataKey === "revenue") {
    return formatUsd(n, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  }
  return formatNumber(n);
}

export function BarChartCard({
  title,
  data,
  dataKey = "orders",
  nameKey = "name",
  color = "#0d9488",
  showDataLabels = false,
  showAllCategoryLabels = false,
  categoryAxisWidth = 100,
  barRowHeight = 32,
  dataLabelKey,
  embedded = false,
  className,
}: {
  title: string;
  data: Array<{ name: string; orders: number; revenue: number; units?: number }>;
  dataKey?: "orders" | "revenue" | "units";
  nameKey?: string;
  color?: string;
  showDataLabels?: boolean;
  /** Force every category label on the Y-axis (grows chart height per bar). */
  showAllCategoryLabels?: boolean;
  categoryAxisWidth?: number;
  barRowHeight?: number;
  /** Field on each row for bar-end labels (falls back to numeric dataKey). */
  dataLabelKey?: string;
  embedded?: boolean;
  className?: string;
}) {
  const chartTheme = useChartTheme();
  const showInfo = dataKey === "revenue";
  const chartData = data.filter((row) => Number(row[dataKey]) > 0);
  const chartHeight = showAllCategoryLabels
    ? Math.max(288, chartData.length * barRowHeight + 40)
    : 288;
  const labelMarginRight = dataLabelKey ? 148 : showDataLabels ? 56 : 16;
  const labelListKey = dataLabelKey ?? dataKey;

  return (
    <ChartCardShell
      title={title}
      variant={showInfo ? "revenue" : "bar"}
      embedded={embedded}
      className={className}
      infoContent={showInfo ? <RevenueUsdInfoContent /> : undefined}
    >
      <div className="w-full min-w-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              left: 4,
              right: labelMarginRight,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke={chartTheme.gridStroke}
            />
            <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.tickFill }} />
            <YAxis
              type="category"
              dataKey={nameKey}
              width={categoryAxisWidth}
              interval={showAllCategoryLabels ? 0 : "preserveStartEnd"}
              tick={{ fontSize: 11, fill: chartTheme.tickFill }}
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${chartTheme.tooltipBorder}`,
                backgroundColor: chartTheme.tooltipBg,
                color: chartTheme.labelFill,
                fontSize: 12,
              }}
              formatter={(value, _name, item) => {
                const row = item?.payload as Record<string, unknown> | undefined;
                if (dataLabelKey && row?.[dataLabelKey] != null) {
                  return [String(row[dataLabelKey]), ""];
                }
                return [formatBarDataLabel(value, dataKey), "Orders"];
              }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} activeBar={false}>
              {showDataLabels ? (
                <LabelList
                  dataKey={labelListKey}
                  position="right"
                  offset={6}
                  formatter={(value) =>
                    dataLabelKey
                      ? String(value ?? "")
                      : formatBarDataLabel(value, dataKey)
                  }
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fill: chartTheme.labelFill,
                  }}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCardShell>
  );
}
