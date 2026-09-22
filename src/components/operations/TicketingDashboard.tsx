import { TicketingDayStatsButton } from "@/components/operations/TicketingDayStatsDialog";
import { KpiCard } from "@/components/orders/kpi-card";
import type {
  TicketCategoryRow,
  TicketDirectionKpis,
  TicketingData,
} from "@/lib/operations/ticketing";
import {
  formatHoursAvg,
  formatMinutesAvg,
} from "@/lib/operations/ticketing";
import { formatNumber } from "@/lib/utils";

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function countAndPct(count: number, rateValue: number): string {
  return `${formatNumber(count)} (${pct(rateValue)})`;
}

function DirectionTable({
  inbound,
  outbound,
  showInbound,
  showOutbound,
}: {
  inbound: TicketDirectionKpis;
  outbound: TicketDirectionKpis;
  showInbound: boolean;
  showOutbound: boolean;
}) {
  const rows: Array<{ label: string; kpis: TicketDirectionKpis }> = [];
  if (showInbound) rows.push({ label: "Inbound", kpis: inbound });
  if (showOutbound) rows.push({ label: "Outbound", kpis: outbound });
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Direction</th>
            <th className="px-3 py-2 text-right">Tickets</th>
            <th className="px-3 py-2 text-right">Pending</th>
            <th className="px-3 py-2 text-right">In process</th>
            <th className="px-3 py-2 text-right">Awaiting seller</th>
            <th className="px-3 py-2 text-right">Resolved</th>
            <th className="px-3 py-2 text-right">Avg 1st reply</th>
            <th className="px-3 py-2 text-right">Avg resolve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-[var(--card-border)]">
              <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                {row.label}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(row.kpis.tickets)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countAndPct(row.kpis.pending, row.kpis.pendingRate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countAndPct(row.kpis.inProgress, row.kpis.inProgressRate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countAndPct(row.kpis.awaitingSeller, row.kpis.awaitingSellerRate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countAndPct(row.kpis.resolved, row.kpis.resolvedRate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMinutesAvg(row.kpis.avgFirstReplyMinutes)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatHoursAvg(row.kpis.avgResolutionHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({
  rows,
  showSubcategory,
}: {
  rows: TicketCategoryRow[];
  showSubcategory?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">
        No tickets in this breakdown.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2">Category</th>
            {showSubcategory ? (
              <th className="px-3 py-2">Sub-category</th>
            ) : null}
            <th className="px-3 py-2 text-right">Tickets</th>
            <th className="px-3 py-2 text-right">Pending</th>
            <th className="px-3 py-2 text-right">In process</th>
            <th className="px-3 py-2 text-right">Resolved</th>
            <th className="px-3 py-2 text-right">Avg 1st reply</th>
            <th className="px-3 py-2 text-right">Avg resolve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.category}-${row.subCategory ?? ""}`}
              className="border-t border-[var(--card-border)]"
            >
              <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                {row.category}
              </td>
              {showSubcategory ? (
                <td className="px-3 py-2 text-[var(--muted)]">
                  {row.subCategory ?? "—"}
                </td>
              ) : null}
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(row.tickets)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(row.pending)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(row.inProgress)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {countAndPct(row.resolved, row.resolvedRate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMinutesAvg(row.avgFirstReplyMinutes)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatHoursAvg(row.avgResolutionHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TicketingDashboard({
  data,
  direction,
  from,
  to,
}: {
  data: TicketingData;
  direction: string;
  from: string;
  to: string;
}) {
  if (!data.available || data.sourceRowCount === 0) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--foreground)]">
          No Ticketing Raw Data has been synced yet
        </p>
        <p className="mt-2">
          Run <strong>setup_ops_ticketing.sql</strong> in Supabase if this is the
          first load, then click <strong>Sync Data</strong>.
        </p>
      </div>
    );
  }

  if (data.all.tickets === 0) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
        Synced ticketing data exists, but nothing matches the current date /
        direction filters. Dates use <strong>Final Ticket Date</strong> (column D).
      </div>
    );
  }

  const showInbound = direction !== "Outbound";
  const showOutbound = direction !== "Inbound";

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Ticket status
          </h2>
          <TicketingDayStatsButton
            section={
              direction === "Inbound"
                ? "inbound"
                : direction === "Outbound"
                  ? "outbound"
                  : "overview"
            }
            from={from}
            to={to}
            direction={direction}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            compact
            variant="orders"
            title="Tickets"
            value={formatNumber(data.all.tickets)}
          />
          <KpiCard
            compact
            variant="items"
            title="Pending"
            value={countAndPct(data.all.pending, data.all.pendingRate)}
          />
          <KpiCard
            compact
            variant="delivered"
            title="In process"
            value={countAndPct(data.all.inProgress, data.all.inProgressRate)}
          />
          <KpiCard
            compact
            variant="return"
            title="Awaiting seller"
            value={countAndPct(data.all.awaitingSeller, data.all.awaitingSellerRate)}
          />
          <KpiCard
            compact
            variant="revenue"
            title="Resolved"
            value={countAndPct(data.all.resolved, data.all.resolvedRate)}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-xs text-[var(--muted)]">
          <p>
            Avg first staff reply{" "}
            <span className="font-semibold tabular-nums text-[var(--foreground)]">
              {formatMinutesAvg(data.all.avgFirstReplyMinutes)}
            </span>
          </p>
          <p>
            Avg hours to resolve{" "}
            <span className="font-semibold tabular-nums text-[var(--foreground)]">
              {formatHoursAvg(data.all.avgResolutionHours)}
            </span>
          </p>
        </div>
      </section>

      {showInbound && showOutbound ? (
        <section>
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Inbound vs outbound
            </h2>
          </div>
          <DirectionTable
            inbound={data.inbound}
            outbound={data.outbound}
            showInbound
            showOutbound
          />
        </section>
      ) : (
        <section>
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {showInbound ? "Inbound tickets" : "Outbound tickets"}
            </h2>
          </div>
          <DirectionTable
            inbound={data.inbound}
            outbound={data.outbound}
            showInbound={showInbound}
            showOutbound={showOutbound}
          />
        </section>
      )}

      <section>
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Category performance
          </h2>
        </div>
        <CategoryTable rows={data.categories} />
      </section>

      <section>
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Sub-category performance
          </h2>
        </div>
        <CategoryTable rows={data.subcategories} showSubcategory />
      </section>
    </div>
  );
}
