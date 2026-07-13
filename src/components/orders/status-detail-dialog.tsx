"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { StatusDetailDeliveredView } from "@/components/orders/status-detail-delivered-view";
import { StatusDetailStandardView } from "@/components/orders/status-detail-standard-view";
import type { StatusDetailResponse } from "@/lib/analytics/status-detail";
import { statusColor } from "@/lib/constants";
import {
  buildStatusDetailSearchParams,
  isOrdersOverviewPath,
} from "@/lib/orders/params";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import { cn } from "@/lib/utils";

type ApiResponse = {
  status: string;
  range: { from: string; to: string };
  detail: StatusDetailResponse;
};

export function StatusDetailDialog(
  props: {
    statusName: string | null;
    open: boolean;
    onClose: () => void;
  },
) {
  return (
    <Suspense fallback={null}>
      <StatusDetailDialogInner {...props} />
    </Suspense>
  );
}

function StatusDetailDialogInner({
  statusName,
  open,
  onClose,
}: {
  statusName: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateOnly = isOrdersOverviewPath(pathname);
  const filterQueryKey = `${dateOnly ? "date" : "full"}:${searchParams.toString()}`;

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

  const fetchDetail = useCallback(
    async (signal: AbortSignal) => {
      if (!statusName) return;

      const query = buildStatusDetailSearchParams(searchParams, statusName, {
        dateOnly,
      });

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders/status-detail?${query.toString()}`, {
          signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load status details");
        }
        const data = (await res.json()) as ApiResponse;
        setPayload(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load status details",
        );
        setPayload(null);
      } finally {
        setLoading(false);
      }
    },
    [statusName, searchParams, filterQueryKey, dateOnly],
  );

  useEffect(() => {
    if (!open || !statusName) return;
    const controller = new AbortController();
    void fetchDetail(controller.signal);
    return () => controller.abort();
  }, [open, statusName, fetchDetail]);

  const color = statusName ? statusColor(statusName) : "#64748b";

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

  const isDeliveredDetail =
    !loading && !error && payload?.detail.kind === "delivered";

  const isStandardDetail =
    !loading && !error && payload?.detail.kind === "standard";

  const useWidePanel = loading || isDeliveredDetail || isStandardDetail;

  const breakdownSubtitle = isDeliveredDetail
    ? "Country & product breakdown"
    : "Country, tag & product breakdown";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="status-detail-title"
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
          "relative flex h-full w-full flex-col overflow-hidden rounded-none border border-[var(--card-border)] bg-[var(--card)] shadow-2xl sm:max-h-[min(90vh,52rem)] sm:rounded-2xl",
          useWidePanel
            ? "max-h-[100dvh] sm:max-h-[min(90vh,52rem)] sm:max-w-5xl"
            : "max-h-[100dvh] sm:max-h-[min(85vh,28rem)] sm:max-w-md",
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-500/20 blur-2xl" />

        <div className="relative flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <span
            className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2
              id="status-detail-title"
              className="text-base font-semibold tracking-tight text-[var(--foreground)]"
            >
              {statusName ?? "Status"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {rangeLabel
                ? `${breakdownSubtitle} · ${rangeLabel}`
                : breakdownSubtitle}
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

        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-hidden",
            !isDeliveredDetail && !isStandardDetail && "overflow-auto px-5 py-4",
          )}
        >
          {loading ? (
            <PortalDialogLoading />
          ) : null}

          {!loading && error ? (
            <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p>
          ) : null}

          {isDeliveredDetail && payload?.detail.kind === "delivered" ? (
            <StatusDetailDeliveredView data={payload.detail} />
          ) : null}

          {isStandardDetail && payload?.detail.kind === "standard" ? (
            <StatusDetailStandardView data={payload.detail} />
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
