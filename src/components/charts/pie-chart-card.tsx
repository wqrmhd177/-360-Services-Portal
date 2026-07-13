"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartCardShell } from "@/components/charts/chart-card-shell";
import { StatusDetailDialog } from "@/components/orders/status-detail-dialog";
import { statusColor } from "@/lib/constants";
import { useChartTheme } from "@/lib/theme/chart-theme";
import { cn } from "@/lib/utils";

type Slice = { name: string; value: number };

/** CSS vars for animated status-colored hover (rgb triplet for modern alpha syntax). */
function statusLegendStyle(hex: string): CSSProperties {
  const raw = hex.trim().replace(/^#/, "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return { "--status-color": hex } as CSSProperties;
  }

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);

  return {
    "--status-color": hex.startsWith("#") ? hex : `#${hex}`,
    "--status-rgb": `${r} ${g} ${b}`,
  } as CSSProperties;
}

function StatusMixTooltip({
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

export function PieChartCard({
  title,
  data,
  totalOrders,
  embedded = false,
  wide = false,
  className,
}: {
  title: string;
  data: Slice[];
  totalOrders?: number;
  embedded?: boolean;
  wide?: boolean;
  className?: string;
}) {
  const chartTheme = useChartTheme();
  const sorted = useMemo(
    () => [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value),
    [data],
  );

  const sliceSum = useMemo(
    () => sorted.reduce((sum, d) => sum + d.value, 0),
    [sorted],
  );

  const total = totalOrders && totalOrders > 0 ? totalOrders : sliceSum;

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const dialogOpen = selectedStatus !== null;

  const openStatusDetail = useCallback((name: string) => {
    setSelectedStatus(name);
  }, []);

  const closeStatusDetail = useCallback(() => {
    setSelectedStatus(null);
  }, []);

  const handlePieClick = useCallback(
    (sector: { name?: string | number }) => {
      const name = sector?.name != null ? String(sector.name) : "";
      if (name) openStatusDetail(name);
    },
    [openStatusDetail],
  );

  return (
    <>
    <ChartCardShell
      title={title}
      variant="status"
      embedded={embedded}
      className={className}
      contentClassName={cn("gap-3", wide && "sm:flex-row sm:items-start sm:gap-8")}
    >
      <div
        className={cn(
          "relative mx-auto h-44 w-full min-w-0 shrink-0 sm:mx-0",
          wide ? "max-w-[220px]" : "max-w-[200px]",
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={sorted}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke={chartTheme.pieSliceStroke}
              strokeWidth={2}
              isAnimationActive
              className="cursor-pointer outline-none"
              onClick={handlePieClick}
            >
              {sorted.map((entry, i) => (
                <Cell key={entry.name} fill={statusColor(entry.name, i)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => (
                <StatusMixTooltip
                  active={active}
                  payload={payload}
                  total={total}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            orders
          </span>
        </div>
      </div>

      <ul
        className={cn(
          "grid min-h-0 flex-1 content-start gap-x-4 gap-y-2 overflow-y-auto pr-1",
          wide ? "grid-cols-2 sm:grid-cols-2" : "grid-cols-2",
        )}
      >
        {sorted.map((entry, i) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          const color = statusColor(entry.name, i);

          return (
            <li key={entry.name}>
              <button
                type="button"
                onClick={() => openStatusDetail(entry.name)}
                style={statusLegendStyle(color)}
                className="status-mix-legend-btn group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
              >
                <span
                  className="relative z-[1] h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--card)] transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span
                  className={cn(
                    "relative z-[1] min-w-0 flex-1 font-medium text-[var(--foreground)] transition-colors duration-200",
                    "group-hover:text-[var(--foreground)]",
                    wide ? "leading-snug" : "truncate",
                  )}
                  title={entry.name}
                >
                  {entry.name}
                </span>
                <span className="relative z-[1] shrink-0 tabular-nums text-xs font-semibold text-[var(--muted)] transition-colors duration-200 group-hover:text-[var(--foreground)]">
                  {pct.toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ChartCardShell>

    <StatusDetailDialog
      statusName={selectedStatus}
      open={dialogOpen}
      onClose={closeStatusDetail}
    />
    </>
  );
}
