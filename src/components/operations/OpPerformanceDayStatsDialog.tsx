"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { PortalDialogLoading } from "@/components/layout/portal-loading";
import type {
  OpDailyData,
  OpDayStatsSection,
} from "@/lib/operations/opPerformance";
import { formatPortalYmdMedium } from "@/lib/portalTimezone";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SECTION_TITLE: Record<OpDayStatsSection, string> = {
  outcome: "Outcome health — day-wise",
  teams: "Team Performance — day-wise",
  trend: "N-3 comparison — day-wise",
  upsell: "Upsell Activity — day-wise",
  lucky: "Lucky Draw Activity — day-wise",
};

function pct(num: number, den: number): string {
  if (!den) return "0.0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function countPct(num: number, den: number): string {
  return `${formatNumber(num)} (${pct(num, den)})`;
}

export function OpPerformanceDayStatsButton({
  section,
  country,
  from,
  to,
}: {
  section: OpDayStatsSection;
  country: string;
  from: string;
  to: string;
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
        <OpPerformanceDayStatsDialog
          section={section}
          country={country}
          from={from}
          to={to}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function OpPerformanceDayStatsDialog({
  section,
  country,
  from,
  to,
  onClose,
}: {
  section: OpDayStatsSection;
  country: string;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OpDailyData | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    setLoading(true);
    setError(null);
    void fetch(`/api/operations/op-performance/daily?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load day-wise stats");
        setData(json.data as OpDailyData);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load day-wise stats");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [country, from, to]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="op-day-stats-title"
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
              id="op-day-stats-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {SECTION_TITLE[section]}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {data
                ? `${formatPortalYmdMedium(data.from)} – ${formatPortalYmdMedium(data.to)}`
                : "Order Date from Raw Data"}
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
              No orders in this date window.
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

function DayStatsTable({
  section,
  data,
}: {
  section: OpDayStatsSection;
  data: OpDailyData;
}) {
  if (section === "teams" || section === "trend") {
    return (
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Cancel</th>
            <th className="px-3 py-2 text-right">Delivered</th>
            <th className="px-3 py-2 text-right">In process</th>
            <th className="px-3 py-2 text-right">Approved</th>
          </tr>
        </thead>
        <tbody>
          {data.days.flatMap((day) =>
            (day.teams.length ? day.teams : [{
              team: "—",
              total: 0,
              cancelled: 0,
              delivered: 0,
              inProcess: 0,
              approved: 0,
            }]).map((team) => (
              <tr
                key={`${day.date}-${team.team}`}
                className="border-t border-[var(--card-border)]"
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatPortalYmdMedium(day.date)}
                </td>
                <td className="px-3 py-2">{team.team}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(team.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(team.cancelled, team.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(team.delivered, team.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(team.inProcess, team.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {countPct(team.approved, team.total)}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    );
  }

  if (section === "upsell") {
    return (
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Pitched</th>
            <th className="px-3 py-2 text-right">Agreed</th>
            <th className="px-3 py-2 text-right">Delivered of agreed</th>
          </tr>
        </thead>
        <tbody>
          {data.days.map((day) => (
            <tr key={day.date} className="border-t border-[var(--card-border)]">
              <td className="px-3 py-2 whitespace-nowrap">
                {formatPortalYmdMedium(day.date)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(day.orders)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countPct(day.upsellPitched, day.orders)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countPct(day.upsellAgreed, day.upsellPitched)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countPct(day.upsellDelivered, day.upsellAgreed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (section === "lucky") {
    return (
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Pitched</th>
            <th className="px-3 py-2 text-right">Pitched and delivered</th>
          </tr>
        </thead>
        <tbody>
          {data.days.map((day) => (
            <tr key={day.date} className="border-t border-[var(--card-border)]">
              <td className="px-3 py-2 whitespace-nowrap">
                {formatPortalYmdMedium(day.date)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(day.orders)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countPct(day.luckyDrawPitched, day.orders)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countPct(day.luckyDrawDelivered, day.luckyDrawPitched)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="min-w-full text-left text-xs">
      <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        <tr>
          <th className="px-3 py-2">Date</th>
          <th className="px-3 py-2 text-right">Orders</th>
          <th className="px-3 py-2 text-right">Pending confirmation</th>
          <th className="px-3 py-2 text-right">Confirmation</th>
          <th className="px-3 py-2 text-right">Cancelled</th>
        </tr>
      </thead>
      <tbody>
        {data.days.map((day) => (
          <tr key={day.date} className="border-t border-[var(--card-border)]">
            <td className="px-3 py-2 whitespace-nowrap">
              {formatPortalYmdMedium(day.date)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatNumber(day.orders)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {countPct(day.pendingConfirmation, day.orders)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {countPct(day.confirmation, day.orders)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {countPct(day.cancelled, day.orders)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
