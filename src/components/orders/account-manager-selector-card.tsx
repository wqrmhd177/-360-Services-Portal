"use client";

import { useCallback, useState } from "react";
import { CHART_VARIANT_STYLES } from "@/components/charts/chart-card-shell";
import { AccountManagerDetailDialog } from "@/components/orders/account-manager-detail-dialog";
import type { BreakdownRow } from "@/lib/analytics/orders";
import { cn, formatNumber } from "@/lib/utils";

export function AccountManagerSelectorCard({
  rows,
  totalOrders,
  className,
}: {
  rows: BreakdownRow[];
  totalOrders: number;
  className?: string;
}) {
  const style = CHART_VARIANT_STYLES.accountManager;
  const Icon = style.icon;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAm, setSelectedAm] = useState<string | null>(null);

  const openDialog = useCallback((accountManager: string | null) => {
    setSelectedAm(accountManager);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedAm(null);
  }, []);

  return (
    <>
      <article
        className={cn(
          "relative flex w-full min-h-[5.75rem] flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-gradient-to-br p-3 shadow-sm ring-1",
          style.gradient,
          style.ring,
          className,
        )}
        aria-label="Orders by account manager"
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-50 blur-xl",
            style.iconBg.replace("/15", "/25"),
          )}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => openDialog(null)}
          className={cn(
            "relative flex w-full shrink-0 items-center gap-2 rounded-lg text-left",
            "transition-colors hover:bg-[var(--card)]/50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2",
          )}
          aria-label="View account manager breakdown"
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              style.iconBg,
            )}
          >
            <Icon className={cn("h-4 w-4", style.iconColor)} strokeWidth={2.5} />
          </div>
          <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--muted)]">
            Account manager
          </p>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold leading-none tracking-tight text-[var(--foreground)] tabular-nums">
              {formatNumber(totalOrders)}
            </p>
            <p className="mt-1 text-[10px] font-medium text-[var(--muted)]">
              Total orders
            </p>
          </div>
        </button>

        <div className="relative mt-2 min-h-0 flex-1 overflow-y-auto pr-0.5">
          {rows.length === 0 ? (
            <p className="py-2 text-center text-[10px] text-[var(--muted)]">
              No account manager data
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li key={row.name}>
                  <button
                    type="button"
                    onClick={() => openDialog(row.name)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] leading-tight",
                      "text-left transition-colors hover:bg-[var(--card)]/60",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40",
                    )}
                    aria-label={`View ${row.name} title breakdown`}
                  >
                    <span
                      className="min-w-0 truncate font-medium text-[var(--foreground)]"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-[var(--foreground)]">
                      {formatNumber(row.orders)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      <AccountManagerDetailDialog
        accountManagers={rows}
        selectedAccountManager={selectedAm}
        open={dialogOpen}
        onClose={closeDialog}
      />
    </>
  );
}
