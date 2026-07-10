"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import OrdersFilterBar from "@/components/operations/OrdersFilterBar";
import type {
  FulfillmentSLA,
  OperationsStatusCounts,
  DeliveryPartnerByCountryData,
  RevenueLossRow,
} from "@/lib/operations/orderAnalytics";
import type { OrderKPIs } from "@/lib/operations/orderAnalytics";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}
function fmtDays(n: number | null) {
  if (n == null) return "–";
  return n.toFixed(1) + "d";
}
function fmtCurrency(n: number, currency: string) {
  return currency + " " + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ── sub-components ────────────────────────────────────────────────────────────

function SlaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function StatusKpiCard({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1 leading-snug">{title}</p>
      <p className="text-2xl font-bold text-blue-700">{fmt(count)}</p>
    </div>
  );
}

interface DeliveryPartnerChartProps {
  data: DeliveryPartnerByCountryData;
}

function DeliveryPartnerChart({ data }: DeliveryPartnerChartProps) {
  const [selectedCountry, setSelectedCountry] = useState("All");
  const rows = data.byCountry[selectedCountry] ?? [];
  const maxOrders = rows[0]?.orders || 1;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Delivery Partner Breakdown</h3>
        <select
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none"
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
        >
          {data.countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        {fmt(data.orderCountByCountry[selectedCountry] ?? 0)} total orders
      </p>
      <div className="space-y-2.5">
        {rows.slice(0, 10).map((r) => (
          <div key={r.name}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-700 font-medium truncate max-w-[60%]">{r.name}</span>
              <span className="text-gray-500">
                {fmt(r.orders)} orders · {fmtPct(r.deliveryRatio)} delivered
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${(r.orders / maxOrders) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No data</p>
        )}
      </div>
    </div>
  );
}

function RevenueLossTable({ rows }: { rows: RevenueLossRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const total = rows.reduce((s, r) => s + r.orders, 0) || 1;

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Revenue Loss Breakdown (Cancelled / Returned)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Category</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Orders</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">% of losses</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Revenue lost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
              const rawChildren =
                r.kind === "group"
                  ? (r.tagSplits ?? []).map((t) => ({ label: t.name, orders: t.orders, revenue: t.revenue }))
                  : (r.statusSplits ?? []).map((s) => ({ label: s.status, orders: s.orders, revenue: s.revenue }));
              const hasChildren = rawChildren.length > 0;
              const isOpen = expanded.has(r.name);
              const children = rawChildren;

              return (
                <>
                  <tr
                    key={r.name}
                    className={`${hasChildren ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => hasChildren && toggle(r.name)}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-800 flex items-center gap-1.5">
                      {hasChildren && (
                        <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
                      )}
                      {r.name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.orders)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmtPct(r.orders / total)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">{fmt(r.revenue)}</td>
                  </tr>
                  {isOpen &&
                    children.map((c) => (
                      <tr key={c.label} className="bg-gray-50/50">
                        <td className="px-4 py-2 pl-9 text-gray-600">{c.label}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{fmt(c.orders)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{fmtPct(c.orders / total)}</td>
                        <td className="px-4 py-2 text-right text-red-500">{fmt(c.revenue)}</td>
                      </tr>
                    ))}
                </>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No revenue loss data</p>
        )}
      </div>
    </div>
  );
}

interface SlaCountryTableProps {
  sla: FulfillmentSLA;
}

function SlaCountryTable({ sla }: SlaCountryTableProps) {
  const metrics: Array<{ key: keyof typeof sla.byCountry; label: string }> = [
    { key: "confirm", label: "Confirm (days)" },
    { key: "ship", label: "Ship (days)" },
    { key: "deliver", label: "Deliver (days)" },
    { key: "return", label: "Return (days)" },
    { key: "shipped48h", label: "Shipped ≤48h" },
  ];
  const countries = sla.byCountry.confirm.map((r) => r.country);

  if (countries.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">SLA by Country</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Country</th>
              {metrics.map((m) => (
                <th key={m.key} className="text-right px-4 py-2.5 text-gray-500 font-medium whitespace-nowrap">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {countries.map((c) => {
              const vals: Record<string, number | null> = {};
              for (const m of metrics) {
                vals[m.key] = sla.byCountry[m.key].find((r) => r.country === c)?.value ?? null;
              }
              return (
                <tr key={c} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c}</td>
                  {metrics.map((m) => (
                    <td key={m.key} className="px-4 py-2.5 text-right text-gray-700">
                      {m.key === "shipped48h"
                        ? vals[m.key] != null ? fmtPct(vals[m.key] as number) : "–"
                        : fmtDays(vals[m.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
}

interface AnalyticsData {
  totalRows: number;
  lastSyncedAt: string | null;
  sla: FulfillmentSLA;
  statusCounts: OperationsStatusCounts;
  deliveryPartner: DeliveryPartnerByCountryData;
  revenueLoss: RevenueLossRow[];
}

const STATUS_GROUPS = [
  { id: "confirmationPending", title: "Confirmation Pending" },
  { id: "approved", title: "Approved" },
  { id: "dispatching", title: "Dispatching" },
  { id: "shipped", title: "Shipped" },
  { id: "undelivered", title: "Undelivered" },
  { id: "preDispatchCancelled", title: "Pre-Dispatch Cancelled" },
  { id: "return", title: "Return" },
] as const;

export default function OrdersPage() {
  const sp = useSearchParams();
  const country = sp.get("country") ?? "";
  const bifurcation = sp.get("bifurcation") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ countries: [], bifurcations: [] });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/orders/filter-options");
      if (res.ok) setFilterOpts(await res.json());
    } catch {}
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (country) params.set("country", country);
      if (bifurcation) params.set("bifurcation", bifurcation);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/operations/orders/analytics?${params}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 500 && (data.error ?? "").includes("does not exist")) {
          setError("cache-not-ready");
        } else {
          setError(data.error ?? "Failed to load analytics");
        }
        return;
      }
      if (data.totalRows === 0) {
        setError("empty");
        return;
      }
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [country, bifurcation, from, to]);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/operations/orders/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }
      await loadFilterOptions();
      await loadAnalytics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const isEmpty = error === "empty" || error === "cache-not-ready";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Operations — Orders</h1>
          {analytics?.lastSyncedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last synced: {new Date(analytics.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {syncing ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Syncing…
            </>
          ) : (
            "Sync Data"
          )}
        </button>
      </div>

      <OrdersFilterBar
        options={filterOpts}
        country={country}
        bifurcation={bifurcation}
        from={from}
        to={to}
      />

      {loading && (
        <div className="flex justify-center py-20">
          <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {!loading && error && isEmpty && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-8 text-center">
          <p className="text-sm font-medium text-amber-800 mb-1">
            {error === "cache-not-ready"
              ? "Orders cache table not found — please run setup_orders_cache_v2.sql in Supabase first, then sync."
              : "No orders data yet. Click Sync Data to load data from Metabase."}
          </p>
          <button
            onClick={runSync}
            disabled={syncing}
            className="mt-4 rounded-lg bg-amber-600 px-5 py-2 text-sm text-white font-medium hover:bg-amber-700 disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      )}

      {!loading && error && !isEmpty && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* Status KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {STATUS_GROUPS.map((g) => (
              <StatusKpiCard
                key={g.id}
                title={g.title}
                count={analytics.statusCounts.byGroup[g.id]}
              />
            ))}
          </div>

          {/* SLA summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SlaCard label="Avg Confirm (days)" value={fmtDays(analytics.sla.avgOrderToConfirmDays)} />
            <SlaCard label="Avg Ship (days)" value={fmtDays(analytics.sla.avgOrderToShipDays)} />
            <SlaCard label="Avg Deliver (days)" value={fmtDays(analytics.sla.avgOrderToDeliverDays)} />
            <SlaCard label="Avg Return (days)" value={fmtDays(analytics.sla.avgOrderToReturnDays)} />
            <SlaCard label="Shipped ≤48h" value={fmtPct(analytics.sla.shippedWithin48hPct)} />
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DeliveryPartnerChart data={analytics.deliveryPartner} />
            <SlaCountryTable sla={analytics.sla} />
          </div>

          <RevenueLossTable rows={analytics.revenueLoss} />

          <p className="text-xs text-gray-400 text-right">
            Showing analytics over {fmt(analytics.totalRows)} order rows
          </p>
        </>
      )}
    </div>
  );
}
