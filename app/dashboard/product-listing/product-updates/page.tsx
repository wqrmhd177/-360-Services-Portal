"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Loader2,
  X,
} from "lucide-react";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import {
  fetchPriceRequestsByStatus,
  approvePriceChange,
  rejectPriceChange,
} from "@/lib/productListing/priceHistoryHelpers";
import {
  fetchStatusRequestsByStatus,
  approveStatusChangeRequest,
  rejectStatusChangeRequest,
} from "@/lib/productListing/variantStatusChangeHelpers";
import {
  formatVariantLabel,
  sortVariantOptionNames,
  extractImages,
} from "@/lib/productListing/productHelpers";
import type {
  PlPriceHistoryEntry,
  PlVariantStatusChangeRequest,
} from "@/lib/productListing/types";

type StatusTab = "pending" | "approved" | "rejected" | "all";

const ITEMS_PER_PAGE = 25;

// ─── Merged request type ──────────────────────────────────────────────────────
type PriceReq = PlPriceHistoryEntry & {
  request_type: "price";
  product_title?: string;
  option_values?: Record<string, string>;
  variant_image?: string[] | null;
  product_image?: string | string[] | null;
};
type StatusReq = PlVariantStatusChangeRequest & {
  request_type: "status";
  product_title?: string;
  option_values?: Record<string, string>;
  variant_image?: string[] | null;
  product_image?: string | string[] | null;
};
type BothReq = {
  id: string;
  request_type: "both";
  product_id: number;
  variant_id: number;
  created_at: string;
  created_by: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  reviewed_by: string | null;
  product_title?: string;
  option_values?: Record<string, string>;
  variant_image?: string[] | null;
  product_image?: string | string[] | null;
  previous_price: number;
  updated_price: number;
  previous_active: boolean;
  updated_active: boolean;
  price_request_id: string;
  status_request_id: string;
  request_scope?: "variant" | "product";
};
type MergedRequest = PriceReq | StatusReq | BothReq;

function toMinuteBucket(iso: string) {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function RequestTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    price: "bg-blue-100 text-blue-800",
    status: "bg-purple-100 text-purple-800",
    both: "bg-indigo-100 text-indigo-800",
  };
  const labels: Record<string, string> = { price: "Price", status: "Status", both: "Price + Status" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[type] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle className="h-3 w-3" /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      <XCircle className="h-3 w-3" /> Rejected
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductUpdatesPage() {
  const [requests, setRequests] = useState<MergedRequest[]>([]);
  const [tab, setTab] = useState<StatusTab>("pending");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setUserEmail(d?.session?.email ?? ""));
  }, []);

  useEffect(() => {
    load();
  }, [tab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [priceData, statusData] = await Promise.all([
        fetchPriceRequestsByStatus(tab),
        fetchStatusRequestsByStatus(tab),
      ]);

      // Enrich with variant meta
      const allVariantIds = Array.from(
        new Set([...priceData.map((r) => r.variant_id), ...statusData.map((r) => r.variant_id)])
      );

      const supabase = createSupabaseClient();
      let variantMeta = new Map<number, { option_values?: Record<string, string>; image?: string[] | null }>();
      if (allVariantIds.length > 0) {
        const { data } = await supabase
          .from("pl_product_variants")
          .select("variant_id, option_values, image")
          .in("variant_id", allVariantIds);
        variantMeta = new Map(
          (data || []).map((v: { variant_id: number; option_values?: Record<string, string>; image?: string[] | null }) => [v.variant_id, v])
        );
      }

      const allProductIds = Array.from(
        new Set([...priceData.map((r) => r.product_id), ...statusData.map((r) => r.product_id)])
      );
      let productMeta = new Map<number, { product_title: string; image?: string | string[] | null }>();
      if (allProductIds.length > 0) {
        const { data } = await supabase
          .from("pl_products")
          .select("product_id, product_title, image")
          .in("product_id", allProductIds);
        productMeta = new Map(
          (data || []).map((p: { product_id: number; product_title: string; image?: string | string[] | null }) => [p.product_id, p])
        );
      }

      // Merge price + status requests created in the same minute
      const groups = new Map<string, { price?: PlPriceHistoryEntry; status?: PlVariantStatusChangeRequest }>();

      priceData.forEach((r) => {
        const key = `${r.status}|${r.product_id}|${r.variant_id}|${r.created_by ?? ""}|${toMinuteBucket(r.created_at)}`;
        const ex = groups.get(key) ?? {};
        groups.set(key, { ...ex, price: r });
      });

      statusData.forEach((r) => {
        const scope = r.request_scope ?? "variant";
        const key =
          scope === "product"
            ? `${r.status}|product|${r.product_id}|${r.created_by ?? ""}|${toMinuteBucket(r.created_at)}`
            : `${r.status}|${r.product_id}|${r.variant_id}|${r.created_by ?? ""}|${toMinuteBucket(r.created_at)}`;
        const ex = groups.get(key) ?? {};
        groups.set(key, { ...ex, status: r });
      });

      const merged: MergedRequest[] = Array.from(groups.values())
        .map((g): MergedRequest => {
          const getVariantInfo = (vid: number) => variantMeta.get(vid);
          const getProductInfo = (pid: number) => productMeta.get(pid);

          if (g.price && g.status) {
            const vm = getVariantInfo(g.price.variant_id);
            const pm = getProductInfo(g.price.product_id);
            return {
              id: `${g.price.id}|${g.status.id}`,
              request_type: "both",
              product_id: g.price.product_id,
              variant_id: g.price.variant_id,
              created_at: g.price.created_at > g.status.created_at ? g.price.created_at : g.status.created_at,
              created_by: g.price.created_by ?? g.status.created_by,
              status: g.price.status,
              reviewed_at: g.price.reviewed_at ?? g.status.reviewed_at,
              reviewed_by: g.price.reviewed_by ?? g.status.reviewed_by,
              product_title: pm?.product_title,
              option_values: vm?.option_values ?? undefined,
              variant_image: vm?.image,
              product_image: pm?.image,
              previous_price: g.price.previous_price,
              updated_price: g.price.updated_price,
              previous_active: g.status.previous_active,
              updated_active: g.status.updated_active,
              price_request_id: g.price.id,
              status_request_id: g.status.id,
              request_scope: g.status.request_scope,
            };
          }

          if (g.price) {
            const vm = getVariantInfo(g.price.variant_id);
            const pm = getProductInfo(g.price.product_id);
            return {
              ...g.price,
              request_type: "price",
              product_title: pm?.product_title,
              option_values: vm?.option_values ?? undefined,
              variant_image: vm?.image,
              product_image: pm?.image,
            };
          }

          const s = g.status!;
          const vm = getVariantInfo(s.variant_id);
          const pm = getProductInfo(s.product_id);
          return {
            ...s,
            request_type: "status",
            product_title: pm?.product_title,
            option_values: vm?.option_values ?? undefined,
            variant_image: vm?.image,
            product_image: pm?.image,
          };
        })
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      setRequests(merged);
    } catch {
      setError("Failed to load approval requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(req: MergedRequest) {
    if (!userEmail) return;
    setProcessing(req.id);
    setError("");
    setSuccess("");
    try {
      let ok = false;
      if (req.request_type === "price") {
        ok = await approvePriceChange(req.id, userEmail);
      } else if (req.request_type === "status") {
        ok = await approveStatusChangeRequest(req.id, userEmail);
      } else {
        const r = req as BothReq;
        const a = await approvePriceChange(r.price_request_id, userEmail);
        const b = await approveStatusChangeRequest(r.status_request_id, userEmail);
        ok = a && b;
      }
      if (ok) {
        setSuccess(`Approved: ${req.product_title ?? `Product #${req.product_id}`}`);
        await load();
      } else {
        setError("Failed to approve request");
      }
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(req: MergedRequest) {
    if (!userEmail) return;
    setProcessing(req.id);
    setError("");
    setSuccess("");
    try {
      let ok = false;
      if (req.request_type === "price") {
        ok = await rejectPriceChange(req.id, userEmail);
      } else if (req.request_type === "status") {
        ok = await rejectStatusChangeRequest(req.id, userEmail);
      } else {
        const r = req as BothReq;
        const a = await rejectPriceChange(r.price_request_id, userEmail);
        const b = await rejectStatusChangeRequest(r.status_request_id, userEmail);
        ok = a && b;
      }
      if (ok) {
        setSuccess(`Rejected: ${req.product_title ?? `Product #${req.product_id}`}`);
        await load();
      } else {
        setError("Failed to reject request");
      }
    } finally {
      setProcessing(null);
    }
  }

  function getThumbnail(req: MergedRequest): string | undefined {
    const vi = extractImages(req.variant_image ?? null);
    if (vi.length > 0) return vi[0];
    const pi = extractImages(req.product_image ?? null);
    return pi[0];
  }

  function getVariantLabel(req: MergedRequest): string {
    if ("request_scope" in req && req.request_scope === "product") return "All Variants";
    if (req.option_values) return formatVariantLabel(req.option_values);
    return `Variant #${req.variant_id}`;
  }

  const totalPages = Math.max(1, Math.ceil(requests.length / ITEMS_PER_PAGE));
  const paginated = requests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Product Updates"
        subtitle="Review and approve pending price and status change requests"
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Filter className="h-5 w-5 self-center text-gray-400" />
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-portal-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Clock className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            No {tab !== "all" ? tab : ""} requests found
          </p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="card hidden overflow-hidden p-0 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-center">Variant</th>
                    <th className="px-4 py-3 text-center">Type</th>
                    <th className="px-4 py-3 text-center">Change</th>
                    <th className="px-4 py-3 text-center">Requested By</th>
                    <th className="px-4 py-3 text-center">Date</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {tab === "pending" && <th className="px-4 py-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginated.map((req) => {
                    const thumb = getThumbnail(req);
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {thumb ? (
                              <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover" />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 border border-gray-200" />
                            )}
                            <span className="max-w-[160px] truncate font-medium text-gray-900">
                              {req.product_title ?? `Product #${req.product_id}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-xs text-gray-600">{getVariantLabel(req)}</div>
                          {req.option_values && Object.keys(req.option_values).length > 0 && (
                            <div className="mt-1 flex flex-wrap justify-center gap-1">
                              {sortVariantOptionNames(Object.keys(req.option_values)).map((k) => (
                                <span key={k} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                                  {k}: {req.option_values![k]}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <RequestTypeBadge type={req.request_type} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChangeCell req={req} />
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">
                          {req.created_by ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">
                          {formatDate(req.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={req.status} />
                        </td>
                        {tab === "pending" && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                disabled={processing === req.id}
                                onClick={() => handleApprove(req)}
                                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {processing === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={processing === req.id}
                                onClick={() => handleReject(req)}
                                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {processing === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile cards ── */}
          <div className="space-y-3 md:hidden">
            {paginated.map((req) => {
              const thumb = getThumbnail(req);
              return (
                <div key={req.id} className="card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover" />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 border border-gray-200" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {req.product_title ?? `Product #${req.product_id}`}
                        </p>
                        <p className="text-xs text-gray-500">{getVariantLabel(req)}</p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <RequestTypeBadge type={req.request_type} />
                    <span className="text-xs text-gray-500">{formatDate(req.created_at)}</span>
                  </div>
                  <ChangeCell req={req} />
                  {tab === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={processing === req.id}
                        onClick={() => handleApprove(req)}
                        className="flex-1 rounded-lg bg-green-600 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {processing === req.id ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={processing === req.id}
                        onClick={() => handleReject(req)}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {processing === req.id ? "…" : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{requests.length} requests</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  Previous
                </button>
                <span>{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Change cell ──────────────────────────────────────────────────────────────
function ChangeCell({ req }: { req: MergedRequest }) {
  if (req.request_type === "price") {
    const r = req as PriceReq;
    const pct = r.previous_price
      ? (((r.updated_price - r.previous_price) / r.previous_price) * 100).toFixed(1)
      : null;
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs">
        <span className="line-through text-gray-400">{r.previous_price.toFixed(2)}</span>
        <span className="text-gray-400">→</span>
        <span className="font-semibold text-gray-900">{r.updated_price.toFixed(2)}</span>
        {pct && (
          <span className={parseFloat(pct) >= 0 ? "text-green-600" : "text-red-600"}>
            ({parseFloat(pct) >= 0 ? "+" : ""}{pct}%)
          </span>
        )}
      </div>
    );
  }
  if (req.request_type === "status") {
    const r = req as StatusReq;
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs">
        <span className={r.previous_active ? "text-green-700" : "text-gray-500"}>
          {r.previous_active ? "Active" : "Inactive"}
        </span>
        <span className="text-gray-400">→</span>
        <span className={`font-semibold ${r.updated_active ? "text-green-700" : "text-gray-700"}`}>
          {r.updated_active ? "Active" : "Inactive"}
        </span>
      </div>
    );
  }
  // both
  const r = req as BothReq;
  return (
    <div className="flex flex-col items-center gap-0.5 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="line-through text-gray-400">{r.previous_price.toFixed(2)}</span>
        <span className="text-gray-400">→</span>
        <span className="font-semibold text-gray-900">{r.updated_price.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={r.previous_active ? "text-green-700" : "text-gray-500"}>
          {r.previous_active ? "Active" : "Inactive"}
        </span>
        <span className="text-gray-400">→</span>
        <span className={`font-semibold ${r.updated_active ? "text-green-700" : "text-gray-700"}`}>
          {r.updated_active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}
