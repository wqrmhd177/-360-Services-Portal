import {
  DollarSign,
  Package,
  Percent,
  RotateCcw,
  ShoppingBag,
  Truck,
  TrendingUp,
} from "lucide-react";
import { InfoTooltip } from "@/components/orders/info-tooltip";
import { cn } from "@/lib/utils";

/** Shared compact KPI layout (Overview, Stores, Operations). */
export const KPI_COMPACT_GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4 xl:grid-cols-7 lg:gap-2.5 xl:gap-3";

export const KPI_COMPACT_GRID_5_CLASS =
  "grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-5 lg:gap-2.5 xl:gap-3";

/** Operations status row: Total + 7 status groups + Delivered (9 cards, 5+4 layout). */
export const KPI_OPERATIONS_STATUS_GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-2.5 xl:gap-3";

/** Country, account manager + chart selector cards (Overview, Stores). */
export const CHART_SELECTOR_GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-2 xl:grid-cols-4 lg:gap-2.5 xl:gap-3";

export type KpiVariant =
  | "orders"
  | "revenue"
  | "aov"
  | "units"
  | "delivered"
  | "return"
  | "items";

const VARIANT_STYLES: Record<
  KpiVariant,
  {
    icon: typeof Package;
    gradient: string;
    iconBg: string;
    iconColor: string;
    ring: string;
  }
> = {
  orders: {
    icon: ShoppingBag,
    gradient: "from-violet-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-600",
    ring: "ring-violet-500/10",
  },
  revenue: {
    icon: DollarSign,
    gradient: "from-emerald-500/12 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600",
    ring: "ring-emerald-500/15",
  },
  aov: {
    icon: TrendingUp,
    gradient: "from-teal-500/12 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-600",
    ring: "ring-teal-500/15",
  },
  units: {
    icon: Package,
    gradient: "from-blue-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600",
    ring: "ring-blue-500/10",
  },
  delivered: {
    icon: Truck,
    gradient: "from-sky-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-600",
    ring: "ring-sky-500/10",
  },
  return: {
    icon: RotateCcw,
    gradient: "from-rose-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-600",
    ring: "ring-rose-500/10",
  },
  items: {
    icon: Percent,
    gradient: "from-amber-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600",
    ring: "ring-amber-500/10",
  },
};

export function KpiCard({
  title,
  value,
  subtitle,
  variant = "orders",
  className,
  infoContent,
  featured,
  compact,
  onClick,
}: {
  title: string;
  value: string;
  subtitle?: string;
  variant?: KpiVariant;
  className?: string;
  infoTitle?: string;
  infoContent?: React.ReactNode;
  featured?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const style = VARIANT_STYLES[variant];
  const Icon = style.icon;

  const interactive = Boolean(onClick);
  const interactiveClass = interactive
    ? "cursor-pointer text-left hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
    : "";

  if (compact) {
    const Comp = interactive ? "button" : "article";
    return (
      <Comp
        type={interactive ? "button" : undefined}
        onClick={onClick}
        className={cn(
          "group relative flex w-full min-h-[5.75rem] flex-col items-start overflow-hidden rounded-xl border border-[var(--card-border)] bg-gradient-to-br p-3 shadow-sm ring-1 transition-shadow hover:shadow-md",
          style.gradient,
          style.ring,
          interactiveClass,
          className,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-50 blur-xl",
            style.iconBg.replace("/15", "/25"),
          )}
          aria-hidden
        />

        <div className="relative flex w-full items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              style.iconBg,
            )}
          >
            <Icon className={cn("h-4 w-4", style.iconColor)} strokeWidth={2.5} />
          </div>
          <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--muted)]">
            {title}
          </p>
          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
            {infoContent ? (
              <InfoTooltip className="relative right-0 top-0 scale-[0.85]">
                {infoContent}
              </InfoTooltip>
            ) : null}
          </div>
        </div>

        <p className="relative mt-2 w-full text-right text-xl font-bold leading-none tracking-tight text-[var(--foreground)] tabular-nums">
          {value}
        </p>
      </Comp>
    );
  }

  const Comp = interactive ? "button" : "article";
  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-[var(--card-border)] bg-gradient-to-br p-5 shadow-sm ring-1 transition-all duration-300",
        !interactive && "hover:-translate-y-0.5 hover:shadow-md",
        interactive && interactiveClass,
        style.gradient,
        style.ring,
        featured && "sm:col-span-2",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-80",
          style.iconBg.replace("/15", "/25"),
        )}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {title}
          </p>
          <p
            className={cn(
              "mt-2 font-bold tracking-tight text-[var(--foreground)] tabular-nums",
              featured ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
            )}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-xs text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-1">
          {infoContent ? (
            <InfoTooltip className="relative right-0 top-0">
              {infoContent}
            </InfoTooltip>
          ) : null}
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
              style.iconBg,
            )}
          >
            <Icon className={cn("h-5 w-5", style.iconColor)} strokeWidth={2} />
          </div>
        </div>
      </div>
    </Comp>
  );
}
