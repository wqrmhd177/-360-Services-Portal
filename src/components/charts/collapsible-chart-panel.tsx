"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CHART_VARIANT_STYLES,
  type ChartCardVariant,
} from "@/components/charts/chart-card-shell";
import { InfoTooltip } from "@/components/orders/info-tooltip";
import {
  persistChartPanelOpen,
  readChartPanelOpen,
} from "@/lib/charts/panel-storage";
import { cn } from "@/lib/utils";

export function CollapsibleChartPanel({
  title,
  subtitle,
  variant = "orders",
  defaultOpen = true,
  storageKey,
  infoContent,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  variant?: ChartCardVariant;
  defaultOpen?: boolean;
  storageKey?: string;
  infoContent?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  // Load saved state when this panel mounts or its storage key changes (per route).
  useEffect(() => {
    setOpen(readChartPanelOpen(storageKey, defaultOpen));
  }, [storageKey, defaultOpen]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      persistChartPanelOpen(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const style = CHART_VARIANT_STYLES[variant];
  const Icon = style.icon;

  return (
    <article
      className={cn(
        "group/panel relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-gradient-to-br shadow-sm ring-1 transition-[box-shadow,ring-color] duration-300",
        open ? "shadow-md" : "shadow-sm",
        style.gradient,
        style.ring,
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-50 blur-2xl transition-opacity duration-500",
          open ? "opacity-70" : "opacity-40",
          style.iconBg.replace("/15", "/20"),
        )}
        aria-hidden
      />

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className={cn(
          "relative z-10 flex w-full items-center gap-3 px-5 py-4 text-left",
          "transition-colors duration-200 hover:bg-[var(--card)]/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2",
        )}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300",
            open && "scale-105",
            style.iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", style.iconColor)} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h3>
            {infoContent ? (
              <span
                className="inline-flex"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <InfoTooltip>{infoContent}</InfoTooltip>
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)]/70 text-[var(--muted)] shadow-sm backdrop-blur-sm transition-all duration-300",
            open && "rotate-180 bg-[var(--card)] text-[var(--foreground)]",
          )}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          id={panelId}
          className={cn(
            "min-h-0 overflow-hidden",
            "transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <div
            className={cn(
              "border-t border-white/70 px-5 pb-5 pt-3",
              open && "animate-chart-panel-in",
            )}
          >
            {open ? children : null}
          </div>
        </div>
      </div>
    </article>
  );
}
