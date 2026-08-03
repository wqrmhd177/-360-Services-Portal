"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Package, X } from "lucide-react";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import { NdRemarkHistoryModal } from "@/components/operations/NdRemarkHistoryModal";
import {
  NdRemarkStatusCell,
  NdRemarkTextCell,
} from "@/components/operations/NdStoreRemarkEditor";
import type {
  NdMovementSuggestion,
  NdRemarkStatus,
  NdSkuSummaryRow,
  NdStoreDetailRow,
} from "@/lib/operations/ndReport";
import { cn, formatNumber } from "@/lib/utils";

export function NdSkuDetailsDialog({
  row,
  filterQuery,
  open,
  onClose,
}: {
  row: NdSkuSummaryRow | null;
  filterQuery: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<NdStoreDetailRow[]>([]);
  const [suggestions, setSuggestions] = useState<NdMovementSuggestion[]>([]);
  const [historyStore, setHistoryStore] = useState<NdStoreDetailRow | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  const fetchDetails = useCallback(
    async (signal: AbortSignal) => {
      if (!row?.sku || !row.country) return;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(filterQuery);
        params.set("country", row.country);
        params.set("bifurcation", row.bifurcation);

        const res = await fetch(
          `/api/operations/nd-report/${encodeURIComponent(row.sku)}/details?${params.toString()}`,
          { signal, cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load details");
        setStores(json.rows ?? []);
        setSuggestions(json.movement_suggestions ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load details");
        setStores([]);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [filterQuery, row?.bifurcation, row?.country, row?.sku],
  );

  useEffect(() => {
    if (!open || !row) {
      setStores([]);
      setSuggestions([]);
      setError(null);
      setHistoryStore(null);
      return;
    }

    const controller = new AbortController();
    void fetchDetails(controller.signal);
    return () => controller.abort();
  }, [open, row, fetchDetails]);

  const totals = useMemo(
    () => ({
      ndOrders: stores.reduce((sum, s) => sum + s.nd_orders, 0),
      ndQuantity: stores.reduce((sum, s) => sum + s.nd_quantity, 0),
      inTransit: stores.reduce((sum, s) => sum + (s.in_transit_inventory ?? 0), 0),
      poQty: stores.reduce((sum, s) => sum + (s.po_qty ?? 0), 0),
    }),
    [stores],
  );

  const saveStoreRemark = useCallback(
    async (
      store: NdStoreDetailRow,
      patch: Partial<{
        ops_remarks: string | null;
        growth_feedback: string | null;
        status: NdRemarkStatus;
      }>,
    ) => {
      if (!row) return;

      const res = await fetch("/api/operations/nd-report/store-remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: row.country,
          bifurcation: row.bifurcation,
          sku: row.sku,
          store_id: store.store_id,
          ops_remarks: patch.ops_remarks ?? store.ops_remarks ?? "",
          growth_feedback: patch.growth_feedback ?? store.growth_feedback ?? "",
          status: patch.status ?? store.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save remark");

      setStores((prev) =>
        prev.map((s) =>
          s.store_id === store.store_id
            ? {
                ...s,
                ops_remarks:
                  patch.ops_remarks !== undefined ? patch.ops_remarks : s.ops_remarks,
                growth_feedback:
                  patch.growth_feedback !== undefined
                    ? patch.growth_feedback
                    : s.growth_feedback,
                status: patch.status ?? s.status,
                remark_updated_by: json.remark?.updated_by ?? s.remark_updated_by,
                remark_updated_at: json.remark?.updated_at ?? s.remark_updated_at,
              }
            : s,
        ),
      );
    },
    [row],
  );

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
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="nd-details-dialog-title"
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
            "sm:max-h-[min(90vh,44rem)] sm:max-w-6xl sm:rounded-2xl",
          )}
        >
          <div className="relative flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <Package className="h-4 w-4 text-amber-600" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="nd-details-dialog-title"
                className="truncate text-base font-semibold tracking-tight text-[var(--foreground)]"
                title={row.title}
              >
                {row.title}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{row.sku}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {row.country}
                {row.bifurcation ? ` · ${row.bifurcation}` : ""}
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

          <div className="relative min-h-0 flex-1 overflow-auto">
            {loading ? <PortalDialogLoading /> : null}

            {!loading && error ? (
              <div className="px-5 py-8 text-center text-sm text-red-700 dark:text-red-300">
                {error}
                <button
                  type="button"
                  onClick={() => {
                    const controller = new AbortController();
                    void fetchDetails(controller.signal);
                  }}
                  className="ml-2 underline"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!loading && !error && suggestions.length > 0 ? (
              <div className="border-b border-[var(--card-border)] px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Movement Suggestions
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {suggestions.map((s) => (
                    <li
                      key={s.source_sku}
                      className="rounded-lg border border-[var(--card-border)] bg-[var(--table-header)]/50 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs">{s.source_sku}</span>
                      <span className="mx-2 text-[var(--muted)]">→</span>
                      <span className="tabular-nums">
                        Suggest {formatNumber(s.suggested_qty)} (surplus{" "}
                        {formatNumber(s.surplus_qty)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!loading && !error && stores.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
                No store-level ND rows for this SKU in the selected range.
              </p>
            ) : null}

            {!loading && !error && stores.length > 0 ? (
              <>
                <div className="border-b border-[var(--card-border)] bg-gradient-to-r from-[var(--table-header)]/60 to-[var(--table-header)]/20 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Totals
                    </span>
                    <div className="flex flex-wrap gap-4">
                      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          ND Orders
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatNumber(totals.ndOrders)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          ND Qty
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatNumber(totals.ndQuantity)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          PO Qty
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-[var(--muted)]">—</p>
                      </div>
                      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                          In-Transit
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-[var(--muted)]">—</p>
                      </div>
                    </div>
                  </div>
                </div>

                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="sticky top-0 z-10 border-b bg-[var(--table-header)] text-left text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Store Name</th>
                      <th className="px-3 py-3">User ID</th>
                      <th className="px-3 py-3">Store ID</th>
                      <th className="px-3 py-3 text-right">ND Orders</th>
                      <th className="px-3 py-3 text-right">ND Qty</th>
                      <th className="px-3 py-3 text-right">PO Qty</th>
                      <th className="px-3 py-3 text-right">In-Transit</th>
                      <th className="px-3 py-3">Ops Remarks</th>
                      <th className="px-3 py-3">Growth Feedback</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-center">Log</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((store) => (
                      <tr
                        key={store.store_id}
                        className="border-b border-[var(--card-border)] last:border-b-0 hover:bg-[var(--table-row-hover)]"
                      >
                        <td
                          className="max-w-[160px] truncate px-4 py-3 font-medium"
                          title={store.store_name ?? undefined}
                        >
                          {store.store_name ?? "—"}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{store.user_id ?? "—"}</td>
                        <td className="px-3 py-3 tabular-nums">{store.store_id || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(store.nd_orders)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(store.nd_quantity)}
                        </td>
                        <td className="px-3 py-3 text-right text-[var(--muted)]">—</td>
                        <td className="px-3 py-3 text-right text-[var(--muted)]">—</td>
                        <td className="px-3 py-3">
                          <NdRemarkTextCell
                            value={store.ops_remarks}
                            placeholder="Ops remarks"
                            onSave={async (next) => {
                              await saveStoreRemark(store, {
                                ops_remarks: next.trim() || null,
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <NdRemarkTextCell
                            value={store.growth_feedback}
                            placeholder="Growth feedback"
                            onSave={async (next) => {
                              await saveStoreRemark(store, {
                                growth_feedback: next.trim() || null,
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <NdRemarkStatusCell
                            value={store.status}
                            onSave={async (next) => {
                              await saveStoreRemark(store, { status: next });
                            }}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setHistoryStore(store)}
                            className="inline-flex rounded p-1 text-[var(--muted)] hover:bg-[var(--table-header)] hover:text-[var(--foreground)]"
                            aria-label="View change history"
                          >
                            <History className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        </div>
      </dialog>

      {historyStore ? (
        <NdRemarkHistoryModal
          country={row.country}
          bifurcation={row.bifurcation}
          sku={row.sku}
          storeId={historyStore.store_id}
          storeName={historyStore.store_name}
          open={!!historyStore}
          onClose={() => setHistoryStore(null)}
        />
      ) : null}
    </>
  );
}
