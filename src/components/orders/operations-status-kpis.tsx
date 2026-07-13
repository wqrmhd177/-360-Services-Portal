"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  KpiCard,
  KPI_OPERATIONS_STATUS_GRID_CLASS,
} from "@/components/orders/kpi-card";
import {
  OperationsStatusDetailView,
  operationsStatusDetailBreadcrumb,
} from "@/components/orders/operations-status-detail-view";
import type { OperationsStatusOrderDetail } from "@/lib/analytics/operations-status-detail";
import type { OperationsStatusCounts } from "@/lib/analytics/operations-status-detail";
import {
  OPERATIONS_STATUS_KPI_GROUPS,
  type OperationsStatusGroupId,
  type OperationsStatusKpiGroup,
} from "@/lib/operations/status-kpi-groups";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import { cn, formatNumber } from "@/lib/utils";

type ApiResponse = {
  group: string;
  range: { from: string; to: string };
  detail: OperationsStatusOrderDetail;
};

function OperationsStatusDialog({
  groupId,
  title,
  rangeLabel,
  open,
  onClose,
  searchParams,
}: {
  groupId: OperationsStatusGroupId | null;
  title: string;
  rangeLabel: string;
  open: boolean;
  onClose: () => void;
  searchParams: URLSearchParams;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
      if (!groupId) return;

      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams(searchParams.toString());
        query.set("group", groupId);
        const res = await fetch(
          `/api/operations/orders/operations-status-detail?${query.toString()}`,
          { signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Failed to load status details");
        }
        setPayload((await res.json()) as ApiResponse);
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
    [groupId, searchParams],
  );

  useEffect(() => {
    if (!open || !groupId) return;
    const controller = new AbortController();
    void fetchDetail(controller.signal);
    return () => controller.abort();
  }, [open, groupId, fetchDetail]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    onClose();
  };

  const breadcrumb = payload?.detail
    ? operationsStatusDetailBreadcrumb(payload.detail)
    : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="operations-status-detail-title"
      onClose={onClose}
      className={cn(
        "portal-status-dialog",
        "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-4 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="relative flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-500/15 blur-2xl"
          aria-hidden
        />

        <div className="relative flex shrink-0 items-start gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="operations-status-detail-title"
              className="text-base font-semibold tracking-tight text-[var(--foreground)]"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {breadcrumb
                ? `${breadcrumb} · ${rangeLabel}`
                : rangeLabel}
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

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <PortalDialogLoading />
          ) : null}

          {!loading && error ? (
            <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p>
          ) : null}

          {!loading && !error && payload?.detail ? (
            <OperationsStatusDetailView data={payload.detail} />
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

function StatusGroupCard({
  group,
  count,
  onSelect,
}: {
  group: OperationsStatusKpiGroup;
  count: number;
  onSelect: (id: OperationsStatusGroupId) => void;
}) {
  return (
    <KpiCard
      compact
      title={group.title}
      value={formatNumber(count)}
      variant="orders"
      onClick={() => onSelect(group.id)}
    />
  );
}

function OperationsStatusKpisInner({
  counts,
  rangeLabel,
}: {
  counts: OperationsStatusCounts;
  rangeLabel: string;
}) {
  const searchParams = useSearchParams();
  const [activeGroup, setActiveGroup] = useState<OperationsStatusGroupId | null>(
    null,
  );

  const activeConfig = OPERATIONS_STATUS_KPI_GROUPS.find(
    (g) => g.id === activeGroup,
  );

  return (
    <>
      <section className={KPI_OPERATIONS_STATUS_GRID_CLASS}>
        <KpiCard
          compact
          title="Total Orders"
          value={formatNumber(counts.totalOrders)}
          variant="orders"
        />

        {OPERATIONS_STATUS_KPI_GROUPS.map((group) => (
          <span key={group.id} className="contents">
            <StatusGroupCard
              group={group}
              count={counts.byGroup[group.id] ?? 0}
              onSelect={setActiveGroup}
            />
            {group.id === "shipped" ? (
              <KpiCard
                compact
                title="Delivered Orders"
                value={formatNumber(counts.deliveredOrders)}
                variant="delivered"
              />
            ) : null}
          </span>
        ))}
      </section>

      <OperationsStatusDialog
        groupId={activeGroup}
        title={activeConfig?.title ?? ""}
        rangeLabel={rangeLabel}
        open={activeGroup != null}
        onClose={() => setActiveGroup(null)}
        searchParams={searchParams}
      />
    </>
  );
}

export function OperationsStatusKpis(props: {
  counts: OperationsStatusCounts;
  rangeLabel: string;
}) {
  return (
    <Suspense fallback={null}>
      <OperationsStatusKpisInner {...props} />
    </Suspense>
  );
}
