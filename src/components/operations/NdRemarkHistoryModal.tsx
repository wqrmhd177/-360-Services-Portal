"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import type { NdRemarkLog } from "@/lib/operations/ndReport";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<NdRemarkLog["field_name"], string> = {
  ops_remarks: "Ops Remarks",
  growth_feedback: "Growth Feedback",
  status: "Status",
};

export function NdRemarkHistoryModal({
  country,
  bifurcation,
  sku,
  storeId,
  storeName,
  open,
  onClose,
}: {
  country: string;
  bifurcation: string;
  sku: string;
  storeId: number;
  storeName: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<NdRemarkLog[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  const fetchLogs = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          country,
          bifurcation,
          sku,
          store_id: String(storeId),
        });
        const res = await fetch(
          `/api/operations/nd-report/store-remarks/logs?${params.toString()}`,
          { signal, cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load history");
        setLogs(json.logs ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load history");
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [bifurcation, country, sku, storeId],
  );

  useEffect(() => {
    if (!open) {
      setLogs([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    void fetchLogs(controller.signal);
    return () => controller.abort();
  }, [open, fetchLogs]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="nd-remark-history-title"
      onClose={onClose}
      className={cn(
        "portal-status-dialog",
        "fixed inset-0 z-[110] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-0 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="relative flex max-h-[min(80vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl">
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-500/15">
            <History className="h-4 w-4 text-slate-600" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="nd-remark-history-title"
              className="text-base font-semibold tracking-tight text-[var(--foreground)]"
            >
              Change History
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {storeName ?? `Store ${storeId}`} · {sku}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] text-[var(--muted)] hover:bg-[var(--table-header)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">Loading history…</p>
          ) : null}
          {!loading && error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : null}
          {!loading && !error && logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">No changes recorded yet.</p>
          ) : null}
          {!loading && !error && logs.length > 0 ? (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-lg border border-[var(--card-border)] bg-[var(--table-header)]/40 px-3 py-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--foreground)]">
                      {FIELD_LABELS[log.field_name]}
                    </span>
                    <span className="shrink-0 text-[var(--muted)]">
                      {new Date(log.changed_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[var(--muted)]">By {log.changed_by}</p>
                  <div className="mt-2 space-y-1">
                    {log.old_value ? (
                      <p>
                        <span className="text-[var(--muted)]">From:</span>{" "}
                        <span className="line-through opacity-70">{log.old_value}</span>
                      </p>
                    ) : null}
                    {log.new_value ? (
                      <p>
                        <span className="text-[var(--muted)]">To:</span> {log.new_value}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
