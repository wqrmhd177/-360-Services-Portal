"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Users, X } from "lucide-react";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import type { BreakdownRow, TitleDeliveryRow } from "@/lib/analytics/orders";
import {
  buildAccountManagerDetailSearchParams,
  isOrdersOverviewPath,
} from "@/lib/orders/params";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

type ApiResponse = {
  accountManager: string;
  range: { from: string; to: string };
  titles: TitleDeliveryRow[];
};

export function AccountManagerDetailDialog(
  props: {
    accountManagers: BreakdownRow[];
    selectedAccountManager: string | null;
    open: boolean;
    onClose: () => void;
  },
) {
  return (
    <Suspense fallback={null}>
      <AccountManagerDetailDialogInner {...props} />
    </Suspense>
  );
}

function AccountManagerDetailDialogInner({
  accountManagers,
  selectedAccountManager,
  open,
  onClose,
}: {
  accountManagers: BreakdownRow[];
  selectedAccountManager: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateOnly = isOrdersOverviewPath(pathname);
  const filterQueryKey = `${dateOnly ? "date" : "full"}:${searchParams.toString()}`;

  const [activeAm, setActiveAm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveAm(null);
      setPayload(null);
      setError(null);
      return;
    }

    const initial =
      selectedAccountManager ??
      accountManagers.find((row) => row.orders > 0)?.name ??
      accountManagers[0]?.name ??
      null;
    setActiveAm(initial);
  }, [open, selectedAccountManager, accountManagers]);

  const fetchDetail = useCallback(
    async (signal: AbortSignal) => {
      if (!activeAm) return;

      const query = buildAccountManagerDetailSearchParams(
        searchParams,
        activeAm,
        { dateOnly },
      );

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/operations/orders/account-manager-detail?${query.toString()}`,
          { signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error ?? "Failed to load account manager details",
          );
        }
        const data = (await res.json()) as ApiResponse;
        setPayload(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load account manager details",
        );
        setPayload(null);
      } finally {
        setLoading(false);
      }
    },
    [activeAm, searchParams, filterQueryKey, dateOnly],
  );

  useEffect(() => {
    if (!open || !activeAm) return;
    const controller = new AbortController();
    void fetchDetail(controller.signal);
    return () => controller.abort();
  }, [open, activeAm, fetchDetail]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    onClose();
  };

  const rangeLabel =
    payload?.range.from && payload?.range.to
      ? `${payload.range.from} – ${payload.range.to}`
      : null;

  const activeRow = accountManagers.find((row) => row.name === activeAm);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="account-manager-detail-title"
      onClose={onClose}
      className={cn(
        "portal-status-dialog",
        "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-0 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-full max-h-[100dvh] flex-col overflow-hidden rounded-none border border-[var(--card-border)] bg-[var(--card)] shadow-2xl",
          "sm:max-h-[min(90vh,52rem)] sm:max-w-5xl sm:rounded-2xl",
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-rose-500/20 blur-2xl" />

        <div className="relative flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
            <Users className="h-4 w-4 text-rose-600" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="account-manager-detail-title"
              className="text-base font-semibold tracking-tight text-[var(--foreground)]"
            >
              Account managers
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {rangeLabel
                ? `Product title breakdown · ${rangeLabel}`
                : "Product title breakdown"}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] shadow-sm transition-colors hover:bg-[var(--table-header)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <aside className="shrink-0 border-b border-[var(--card-border)] lg:w-56 lg:border-b-0 lg:border-r">
            <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Account manager
            </p>
            <ul className="max-h-40 overflow-y-auto px-2 pb-3 lg:max-h-none lg:flex-1">
              {accountManagers.length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-[var(--muted)]">
                  No account managers
                </li>
              ) : (
                accountManagers.map((row) => {
                  const isActive = row.name === activeAm;
                  return (
                    <li key={row.name}>
                      <button
                        type="button"
                        onClick={() => setActiveAm(row.name)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-rose-500/10 font-semibold text-[var(--foreground)] ring-1 ring-rose-500/20"
                            : "text-[var(--foreground)] hover:bg-[var(--table-row-hover)]",
                        )}
                      >
                        <span className="min-w-0 truncate" title={row.name}>
                          {row.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-xs text-[var(--muted)]">
                          {formatNumber(row.orders)}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-[var(--card-border)] px-5 py-3">
              <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
                {activeAm ?? "Select an account manager"}
              </h3>
              {activeRow ? (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {formatNumber(activeRow.orders)} orders in selected filters
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? <PortalDialogLoading /> : null}

              {!loading && error ? (
                <p className="px-5 py-10 text-center text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              {!loading && !error && activeAm ? (
                <AccountManagerTitleTable titles={payload?.titles ?? []} />
              ) : null}

              {!loading && !error && !activeAm ? (
                <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
                  Select an account manager to view product titles.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function AccountManagerTitleTable({ titles }: { titles: TitleDeliveryRow[] }) {
  if (titles.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">
        No product titles for this account manager.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 border-b bg-[var(--table-header)] text-left text-xs uppercase text-[var(--muted)]">
        <tr>
          <th className="px-5 py-3 font-semibold">Title</th>
          <th className="px-4 py-3 font-semibold">Orders</th>
          <th className="px-4 py-3 font-semibold">Delivered %</th>
        </tr>
      </thead>
      <tbody>
        {titles.map((row) => (
          <tr
            key={row.title}
            className="border-b border-[var(--card-border)] last:border-0"
          >
            <td
              className="max-w-[min(24rem,50vw)] truncate px-5 py-2.5 font-medium"
              title={row.title}
            >
              {row.title}
            </td>
            <td className="px-4 py-2.5 tabular-nums">{formatNumber(row.orders)}</td>
            <td className="px-4 py-2.5 tabular-nums font-medium">
              {formatPercent(row.deliveryRatio)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
