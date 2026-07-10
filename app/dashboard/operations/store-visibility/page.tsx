"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import OrdersFilterBar from "@/components/operations/OrdersFilterBar";
import type {
  OrderKPIs,
  TitleBreakdownRow,
  DeliveryPartnerByCountryData,
} from "@/lib/operations/orderAnalytics";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}
function fmtCurrency(n: number, currency: string) {
  return (currency ? currency + " " : "") + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Delivery partner chart ────────────────────────────────────────────────────

function DeliveryPartnerChart({ data }: { data: DeliveryPartnerByCountryData }) {
  const [selectedCountry, setSelectedCountry] = useState("All");
  const rows = data.byCountry[selectedCountry] ?? [];
  const maxOrders = rows[0]?.orders || 1;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Delivery Partner Breakdown</h3>
        <select
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none"
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
                {fmt(r.orders)} · {fmtPct(r.deliveryRatio)} delivered
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
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

// ── Title breakdown table ─────────────────────────────────────────────────────

function TitleBreakdownTable({ rows }: { rows: TitleBreakdownRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (n: string) =>
    setExpanded((p) => {
      const s = new Set(p);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Product Title Breakdown (Top 20)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Title</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Orders</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Delivered</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Delivery %</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Units</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
              const hasChildren = r.storeSplits.length > 0;
              const isOpen = expanded.has(r.name);
              return (
                <>
                  <tr
                    key={r.name}
                    className={`${hasChildren ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    onClick={() => hasChildren && toggle(r.name)}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-800 flex items-center gap-1.5">
                      {hasChildren && (
                        <span className="text-gray-400 shrink-0">{isOpen ? "▾" : "▸"}</span>
                      )}
                      <span className="truncate max-w-xs">{r.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.orders)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.deliveredOrders)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={r.deliveryRatio >= 0.7 ? "text-emerald-600" : r.deliveryRatio >= 0.4 ? "text-amber-600" : "text-red-500"}>
                        {fmtPct(r.deliveryRatio)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.units)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.revenue)}</td>
                  </tr>
                  {isOpen &&
                    r.storeSplits.map((s) => (
                      <tr key={`${r.name}-${s.name}`} className="bg-gray-50/60">
                        <td className="px-4 py-2 pl-9 text-gray-600 italic">{s.name}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{fmt(s.orders)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{fmt(s.deliveredOrders)}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={s.deliveryRatio >= 0.7 ? "text-emerald-600" : s.deliveryRatio >= 0.4 ? "text-amber-600" : "text-red-500"}>
                            {fmtPct(s.deliveryRatio)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{fmt(s.units)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">—</td>
                      </tr>
                    ))}
                </>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No title data</p>
        )}
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

interface FilterOptions {
  countries: string[];
  bifurcations: string[];
  storeIds: number[];
}

interface AnalyticsData {
  totalRows: number;
  lastSyncedAt: string | null;
  kpis: OrderKPIs;
  titleBreakdown: TitleBreakdownRow[];
  deliveryByCountry: DeliveryPartnerByCountryData;
}

export default function StoreVisibilityPage() {
  const sp = useSearchParams();
  const country = sp.get("country") ?? "";
  const bifurcation = sp.get("bifurcation") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const storeId = sp.get("store_id") ?? "";

  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ countries: [], bifurcations: [], storeIds: [] });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
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
      if (storeId) params.set("store_id", storeId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/operations/store-visibility/analytics?${params}`);
      const data = await res.json();
      if (!res.ok) {
        if ((data.error ?? "").includes("does not exist")) {
          setError("cache-not-ready");
        } else {
          setError(data.error ?? "Failed to load analytics");
        }
        return;
      }
      if (data.totalRows === 0) { setError("empty"); return; }
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [country, bifurcation, storeId, from, to]);

  useEffect(() => { loadFilterOptions(); }, [loadFilterOptions]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const isEmpty = error === "empty" || error === "cache-not-ready";
  const kpis = analytics?.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Operations — Store Visibility</h1>
        {analytics?.lastSyncedAt && (
          <p className="text-xs text-gray-400 mt-0.5">
            Last synced: {new Date(analytics.lastSyncedAt).toLocaleString()}
          </p>
        )}
      </div>

      <OrdersFilterBar
        options={filterOpts}
        country={country}
        bifurcation={bifurcation}
        from={from}
        to={to}
        storeId={storeId}
        showStoreFilter
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
              ? "Orders cache not found. Run setup_orders_cache_v2.sql in Supabase then sync via the Orders page."
              : "No data matches the current filters."}
          </p>
        </div>
      )}

      {!loading && error && !isEmpty && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && analytics && kpis && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Total Orders" value={fmt(kpis.totalOrders)} />
            <KpiCard label="Gross Revenue" value={fmtCurrency(kpis.grossRevenue, kpis.currency)} />
            <KpiCard label="AOV" value={fmtCurrency(kpis.aov, kpis.currency)} />
            <KpiCard label="Units Sold" value={fmt(kpis.unitsSold)} />
            <KpiCard label="Delivered Rate" value={fmtPct(kpis.deliveredRate)} />
            <KpiCard label="Return Rate" value={fmtPct(kpis.returnRate)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DeliveryPartnerChart data={analytics.deliveryByCountry} />
          </div>

          <TitleBreakdownTable rows={analytics.titleBreakdown} />

          <p className="text-xs text-gray-400 text-right">
            Analytics over {fmt(analytics.totalRows)} order rows
          </p>
        </>
      )}
    </div>
  );
}
