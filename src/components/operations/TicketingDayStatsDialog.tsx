"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import type {
  TicketDailyData,
  TicketDayKpis,
  TicketDayStatsSection,
} from "@/lib/operations/ticketing";
import { formatPortalYmdMedium } from "@/lib/portalTimezone";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SECTION_TITLE: Record<TicketDayStatsSection, string> = {
  overview: "Tickets — day-wise",
  inbound: "Inbound tickets — day-wise",
  outbound: "Outbound tickets — day-wise",
};

function pct(num: number, den: number): string {
  if (!den) return "0.0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function countPct(num: number, den: number): string {
  return `${formatNumber(num)} (${pct(num, den)})`;
}

export function TicketingDayStatsButton({
  section,
  from,
  to,
  direction,
}: {
  section: TicketDayStatsSection;
  from: string;
  to: string;
  direction: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        Day-wise
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <TicketingDayStatsDialog
          section={section}
          from={from}
          to={to}
          direction={direction}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function TicketingDayStatsDialog({
  section,
  from,
  to,
  direction,
  onClose,
}: {
  section: TicketDayStatsSection;
  from: string;
  to: string;
  direction: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TicketDailyData | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (direction) params.set("direction", direction);

    setLoading(true);
    setError(null);
    void fetch(`/api/operations/ticketing/daily?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load day-wise stats");
        setData(json.data as TicketDailyData);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load day-wise stats");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [from, to, direction]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="ticket-day-stats-title"
      onClose={onClose}
      className={cn(
        "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-0 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-none border border-[var(--card-border)] bg-[var(--card)] shadow-2xl sm:h-auto sm:max-h-[min(90vh,52rem)] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <h2
              id="ticket-day-stats-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {SECTION_TITLE[section]}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {data
                ? `${formatPortalYmdMedium(data.from)} – ${formatPortalYmdMedium(data.to)}. Days at 100% resolved are hidden.`
                : "Final Ticket Date from Raw Data"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading ? <PortalDialogLoading /> : null}
          {!loading && error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : null}
          {!loading && data && data.days.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              No tickets in this date window.
            </p>
          ) : null}
          {!loading && data && data.days.length > 0 ? (
            <DayStatsTable section={section} data={data} />
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

function sliceForSection(
  section: TicketDayStatsSection,
  day: TicketDailyData["days"][number],
): TicketDayKpis {
  if (section === "inbound") return day.inbound;
  if (section === "outbound") return day.outbound;
  return day.all;
}

function isFullyResolved(kpis: TicketDayKpis): boolean {
  return kpis.tickets > 0 && kpis.resolved >= kpis.tickets;
}

function DayStatsTable({
  section,
  data,
}: {
  section: TicketDayStatsSection;
  data: TicketDailyData;
}) {
  const showSplit = section === "overview";
  const openDays = data.days.filter(
    (day) => !isFullyResolved(sliceForSection(section, day)),
  );
  const hiddenCount = data.days.length - openDays.length;

  if (openDays.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        Every day in this window is 100% resolved
        {hiddenCount
          ? ` (${hiddenCount} day${hiddenCount === 1 ? "" : "s"} hidden)`
          : ""}
        .
      </p>
    );
  }

  const totals = openDays.reduce(
    (acc, day) => {
      const kpis = sliceForSection(section, day);
      acc.tickets += kpis.tickets;
      acc.pending += kpis.pending;
      acc.inProgress += kpis.inProgress;
      acc.awaitingSeller += kpis.awaitingSeller;
      acc.resolved += kpis.resolved;
      acc.inbound += day.inbound.tickets;
      acc.outbound += day.outbound.tickets;
      return acc;
    },
    {
      tickets: 0,
      pending: 0,
      inProgress: 0,
      awaitingSeller: 0,
      resolved: 0,
      inbound: 0,
      outbound: 0,
    },
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-right">Tickets</th>
            {showSplit ? (
              <>
                <th className="px-3 py-2 text-right">Inbound</th>
                <th className="px-3 py-2 text-right">Outbound</th>
              </>
            ) : null}
            <th className="px-3 py-2 text-right">Pending</th>
            <th className="px-3 py-2 text-right">In process</th>
            <th className="px-3 py-2 text-right">Awaiting seller</th>
            <th className="px-3 py-2 text-right">Resolved</th>
            <th className="px-3 py-2 text-right">Resolved %</th>
          </tr>
        </thead>
        <tbody>
          {openDays.map((day) => {
            const kpis = sliceForSection(section, day);
            return (
              <tr key={day.date} className="border-t border-[var(--card-border)]">
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatPortalYmdMedium(day.date)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(kpis.tickets)}
                </td>
                {showSplit ? (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(day.inbound.tickets)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(day.outbound.tickets)}
                    </td>
                  </>
                ) : null}
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(kpis.pending, kpis.tickets)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(kpis.inProgress, kpis.tickets)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(kpis.awaitingSeller, kpis.tickets)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(kpis.resolved)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {pct(kpis.resolved, kpis.tickets)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--card-border)] bg-[var(--table-header)] font-semibold">
            <td className="px-3 py-2">Open days total</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatNumber(totals.tickets)}
            </td>
            {showSplit ? (
              <>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(totals.inbound)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(totals.outbound)}
                </td>
              </>
            ) : null}
            <td className="px-3 py-2 text-right tabular-nums">
              {countPct(totals.pending, totals.tickets)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {countPct(totals.inProgress, totals.tickets)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {countPct(totals.awaitingSeller, totals.tickets)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatNumber(totals.resolved)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {pct(totals.resolved, totals.tickets)}
            </td>
          </tr>
        </tbody>
      </table>
      {hiddenCount > 0 ? (
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Showing {openDays.length} day{openDays.length === 1 ? "" : "s"} below
          100% resolved. {hiddenCount} fully resolved day
          {hiddenCount === 1 ? "" : "s"} hidden.
        </p>
      ) : null}
    </div>
  );
}
