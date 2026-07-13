"use client";

import {
  CHART_VARIANT_STYLES,
  type ChartCardVariant,
} from "@/components/charts/chart-card-shell";
import { cn } from "@/lib/utils";

export function ChartSelectorCard({
  title,
  variant,
  preview,
  hint,
  active,
  onClick,
  className,
  children,
}: {
  title: string;
  variant: ChartCardVariant;
  preview: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const style = CHART_VARIANT_STYLES[variant];
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex w-full min-h-[5.75rem] flex-col items-start overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-left shadow-sm ring-1 transition-all duration-200",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        style.gradient,
        active
          ? cn(
              "border-transparent shadow-md ring-2",
              style.ring.replace("/10", "/40").replace("/15", "/50"),
            )
          : cn("border-[var(--card-border)]", style.ring, "hover:border-[var(--card-border)]/90"),
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-50 blur-xl transition-opacity",
          style.iconBg.replace("/15", "/25"),
          active && "opacity-70",
        )}
        aria-hidden
      />

      <div className="relative flex w-full items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200",
            style.iconBg,
            active && "scale-105",
          )}
        >
          <Icon className={cn("h-4 w-4", style.iconColor)} strokeWidth={2.5} />
        </div>
        <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--muted)]">
          {title}
        </p>
      </div>

      <p className="relative mt-2 w-full truncate text-right text-xl font-bold leading-none tracking-tight text-[var(--foreground)] tabular-nums">
        {preview}
      </p>

      {hint ? (
        <p className="relative mt-1 w-full truncate text-right text-[10px] font-medium text-[var(--muted)]">
          {hint}
        </p>
      ) : null}

      {children ? (
        <div className="relative mt-2 w-full min-w-0">{children}</div>
      ) : null}
    </button>
  );
}
