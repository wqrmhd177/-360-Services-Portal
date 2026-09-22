import { KpiCard } from "@/components/orders/kpi-card";
import { OpPerformanceDayStatsButton } from "@/components/operations/OpPerformanceDayStatsDialog";
import type { OpPerformanceData } from "@/lib/operations/opPerformance";
import { formatPortalYmdMedium } from "@/lib/portalTimezone";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function countAndPct(count: number, rateValue: number): string {
  return `${formatNumber(count)} (${pct(rateValue)})`;
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function OpPerformanceDashboard({
  data,
  country,
  from,
  to,
}: {
  data: OpPerformanceData;
  country: string;
  from: string;
  to: string;
}) {
  if (!data.available || data.sourceRowCount === 0) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--foreground)]">
          No OP Raw Data has been synced yet
        </p>
        <p className="mt-2">
          Click <strong>Sync Data</strong> to load OP Raw Data, then numbers will
          appear for these filters.
        </p>
      </div>
    );
  }

  if (data.totalOrders === 0) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
        Synced OP data exists, but nothing matches the current country / date
        filters. Dates use <strong>Order Date</strong> (column F).
      </div>
    );
  }

  const dayBtn = {
    country,
    from,
    to,
  };

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Outcome health
          </h2>
          <OpPerformanceDayStatsButton section="outcome" {...dayBtn} />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <KpiCard
            compact
            variant="orders"
            title="Orders"
            value={formatNumber(data.totalOrders)}
          />
          <KpiCard
            compact
            variant="items"
            title="Pending Confirmation"
            value={countAndPct(
              data.pendingConfirmation,
              data.pendingConfirmationRate,
            )}
          />
          <KpiCard
            compact
            variant="delivered"
            title="Confirmation Rate"
            value={countAndPct(data.confirmation, data.confirmationRate)}
          />
          <KpiCard
            compact
            variant="return"
            title="Cancel Rate"
            value={countAndPct(data.cancelled, data.cancelRate)}
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Team Performance
          </h2>
          <OpPerformanceDayStatsButton section="teams" {...dayBtn} />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[var(--card-border)]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Team / tag</th>
                <th className="px-3 py-2 text-right">Orders</th>
                <th className="px-3 py-2 text-right">Share</th>
                <th className="px-3 py-2 text-right">Cancelled</th>
                <th className="px-3 py-2 text-right">Delivered</th>
                <th className="px-3 py-2 text-right">In process</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((row) => (
                <tr
                  key={row.team}
                  className="border-t border-[var(--card-border)]"
                >
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                    {row.team}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(row.total)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.share)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.cancelRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.cancelled)})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.deliveredRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.delivered)})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.inProcessRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.inProcess)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            N-3 - Last 10 Days VS Previous 10 Days
          </h2>
          <OpPerformanceDayStatsButton section="trend" {...dayBtn} />
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Last: {formatPortalYmdMedium(data.windows.lastFrom)} –{" "}
          {formatPortalYmdMedium(data.windows.lastTo)}. Previous:{" "}
          {formatPortalYmdMedium(data.windows.prevFrom)} –{" "}
          {formatPortalYmdMedium(data.windows.prevTo)}. Approved uses CS Status
          Approved, excluding AVI Team.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-[var(--card-border)]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[var(--table-header)] text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Last cancel</th>
                <th className="px-3 py-2 text-right">Prev cancel</th>
                <th className="px-3 py-2 text-right">Cancel change</th>
                <th className="px-3 py-2 text-right">Last approved</th>
                <th className="px-3 py-2 text-right">Prev approved</th>
                <th className="px-3 py-2 text-right">Approved change</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((row) => (
                <tr
                  key={row.team}
                  className="border-t border-[var(--card-border)]"
                >
                  <td className="px-3 py-2 font-medium">{row.team}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.lastCancelRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.lastTotal)})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.prevCancelRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.prevTotal)})
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      row.cancelDelta > 0.05
                        ? "text-rose-700"
                        : "text-emerald-700",
                    )}
                  >
                    {signedPct(row.cancelDelta)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.lastApprovedRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.lastApproved)})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct(row.prevApprovedRate)}
                    <span className="ml-1 text-[var(--muted)]">
                      ({formatNumber(row.prevApproved)})
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      row.approvedDelta < -0.05
                        ? "text-rose-700"
                        : "text-emerald-700",
                    )}
                  >
                    {signedPct(row.approvedDelta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Upsell Activity
          </h2>
          <OpPerformanceDayStatsButton section="upsell" {...dayBtn} />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <KpiCard
            compact
            variant="aov"
            title="Pitch Rate"
            value={countAndPct(data.upsellPitched, data.upsellPitchRate)}
          />
          <KpiCard
            compact
            variant="revenue"
            title="Agree Rate"
            value={countAndPct(data.upsellAgreed, data.upsellAgreeRate)}
          />
          <KpiCard
            compact
            variant="delivered"
            title="Delivered of Agreed"
            value={countAndPct(data.upsellDelivered, data.upsellDeliverRate)}
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Lucky Draw Activity
          </h2>
          <OpPerformanceDayStatsButton section="lucky" {...dayBtn} />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <KpiCard
            compact
            variant="aov"
            title="Pitched"
            value={countAndPct(data.luckyDrawPitched, data.luckyDrawPitchRate)}
          />
          <KpiCard
            compact
            variant="delivered"
            title="Pitched and Delivered"
            value={countAndPct(
              data.luckyDrawDelivered,
              data.luckyDrawDeliverRate,
            )}
          />
        </div>
      </section>
    </div>
  );
}
