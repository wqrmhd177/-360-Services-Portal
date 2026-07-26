"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Store, X } from "lucide-react";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import type { SkuPerformanceRow, SkuSellerRow } from "@/lib/operations/skuPerformance";
import { cn, formatNumber, formatOneDecimal } from "@/lib/utils";

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

function formatWa(value: number | null): string {
  if (value == null) return "—";
  return formatOneDecimal(value);
}

export function SkuStoreBreakdownDialog({
  row,
  filterQuery,
  open,
  onClose,
}: {
  row: SkuPerformanceRow | null;
  filterQuery: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<SkuSellerRow[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  const fetchStores = useCallback(
    async (signal: AbortSignal) => {
      if (!row?.sku) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/operations/sku-performance/${encodeURIComponent(row.sku)}/sellers?${filterQuery}`,
          { signal, cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load stores");
        setStores(json.data ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load stores");
        setStores([]);
      } finally {
        setLoading(false);
      }
    },
    [filterQuery, row?.sku],
  );

  useEffect(() => {
    if (!open || !row) {
      setStores([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    void fetchStores(controller.signal);
    return () => controller.abort();
  }, [open, row, fetchStores]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    onClose();
  };

  if (!row) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="sku-store-dialog-title"
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
          "sm:max-h-[min(90vh,40rem)] sm:max-w-4xl sm:rounded-2xl",
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-500/15 blur-2xl" />

        <div className="relative flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
            <Store className="h-4 w-4 text-sky-600" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="sku-store-dialog-title"
              className="truncate text-base font-semibold tracking-tight text-[var(--foreground)]"
              title={row.product_title}
            >
              {row.product_title}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{row.sku}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Store breakdown for selected filters</p>
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

        <div className="relative min-h-0 flex-1 overflow-auto">
          {loading ? <PortalDialogLoading /> : null}

          {!loading && error ? (
            <div className="px-5 py-8 text-center text-sm text-red-700 dark:text-red-300">
              {error}
              <button
                type="button"
                onClick={() => {
                  const controller = new AbortController();
                  void fetchStores(controller.signal);
                }}
                className="ml-2 underline"
              >
                Retry
              </button>
            </div>
          ) : null}

          {!loading && !error && stores.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
              No stores found for this SKU in the selected range.
            </p>
          ) : null}

          {!loading && !error && stores.length > 0 ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 z-10 border-b bg-[var(--table-header)] text-left text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3">Store Name</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Store ID</th>
                  <th className="px-4 py-3 text-right">Approved Qty</th>
                  <th className="px-4 py-3 text-right">D → D %</th>
                  <th className="px-5 py-3 text-right">Wtd. Avg</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr
                    key={`${store.store_id}-${store.user_id ?? "na"}`}
                    className="border-b border-[var(--card-border)] last:border-b-0 hover:bg-[var(--table-row-hover)]"
                  >
                    <td
                      className="max-w-[200px] truncate px-5 py-3 font-medium"
                      title={store.store_name ?? undefined}
                    >
                      {store.store_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{store.user_id ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{store.store_id || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(store.approved_quantity)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPct(store.dispatch_to_delivery_pct)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatWa(store.weighted_average)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        {!loading && !error && stores.length > 0 ? (
          <div className="shrink-0 border-t border-[var(--card-border)] px-5 py-3 text-xs text-[var(--muted)]">
            {stores.length} store{stores.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
