import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Globe,
  LineChart,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
import { InfoTooltip } from "@/components/orders/info-tooltip";
import { cn } from "@/lib/utils";

export type ChartCardVariant =
  | "orders"
  | "status"
  | "revenue"
  | "bar"
  | "country"
  | "accountManager";

export const CHART_VARIANT_STYLES: Record<
  ChartCardVariant,
  {
    icon: LucideIcon;
    gradient: string;
    iconBg: string;
    iconColor: string;
    ring: string;
  }
> = {
  orders: {
    icon: LineChart,
    gradient: "from-teal-500/12 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-600",
    ring: "ring-teal-500/15",
  },
  status: {
    icon: PieChart,
    gradient: "from-violet-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-600",
    ring: "ring-violet-500/10",
  },
  revenue: {
    icon: TrendingUp,
    gradient: "from-emerald-500/12 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600",
    ring: "ring-emerald-500/15",
  },
  bar: {
    icon: BarChart3,
    gradient: "from-blue-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600",
    ring: "ring-blue-500/10",
  },
  country: {
    icon: Globe,
    gradient: "from-amber-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600",
    ring: "ring-amber-500/10",
  },
  accountManager: {
    icon: Users,
    gradient: "from-rose-500/10 via-[var(--card)] to-[var(--card)]",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-600",
    ring: "ring-rose-500/10",
  },
};

export function ChartCardShell({
  title,
  variant = "orders",
  embedded = false,
  className,
  contentClassName,
  infoContent,
  children,
}: {
  title: string;
  variant?: ChartCardVariant;
  embedded?: boolean;
  className?: string;
  contentClassName?: string;
  infoContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  const style = CHART_VARIANT_STYLES[variant];
  const Icon = style.icon;

  if (embedded) {
    return (
      <div
        className={cn(
          "relative flex w-full min-w-0 flex-col",
          contentClassName,
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-gradient-to-br p-5 shadow-sm ring-1 transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-md",
        style.gradient,
        style.ring,
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-80",
          style.iconBg.replace("/15", "/25"),
        )}
        aria-hidden
      ></div>

      <div className="relative flex shrink-0 items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </p>
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

      <div className={cn("relative mt-4 flex w-full min-w-0 flex-1 flex-col", contentClassName)}>
        {children}
      </div>
    </article>
  );
}
