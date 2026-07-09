"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  Filter,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import {
  fetchProductsWithVariants,
  deleteProduct,
  updateProductStatus,
  extractImages,
  getProductThumbnail,
  formatVariantLabel,
  sortVariantOptionNames,
} from "@/lib/productListing/productHelpers";
import { fetchAllSuppliers } from "@/lib/productListing/supplierHelpers";
import {
  createPriceHistoryEntry,
} from "@/lib/productListing/priceHistoryHelpers";
import {
  createVariantStatusChangeRequest,
} from "@/lib/productListing/variantStatusChangeHelpers";
import type { PlGroupedProduct, PlVariantInfo, PlSupplier } from "@/lib/productListing/types";

const ITEMS_PER_PAGE = 25;

type StatusFilter = "all" | "pending" | "approved" | "active" | "inactive" | "rejected";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    approved: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
    inactive: "bg-gray-100 text-gray-600",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status === "pending" ? "Pending Approval" : status}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initSupplier = searchParams.get("supplier") ?? "all";

  const [products, setProducts] = useState<PlGroupedProduct[]>([]);
  const [suppliers, setSuppliers] = useState<PlSupplier[]>([]);
  const [supplierFilter, setSupplierFilter] = useState(initSupplier);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // View modal
  const [viewProduct, setViewProduct] = useState<PlGroupedProduct | null>(null);
  const [viewImages, setViewImages] = useState<string[]>([]);
  const [imageIdx, setImageIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // Edit prices (inside view modal)
  const [editPrices, setEditPrices] = useState<Map<number, number>>(new Map());
  const [editActive, setEditActive] = useState<Map<number, boolean>>(new Map());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, inactive: 0, rejected: 0 });

  // User email for audit
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setUserEmail(d?.session?.email ?? ""));
  }, []);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, supplierFilter, search]);

  async function loadAll() {
    setLoading(true);
    try {
      const [prods, sups] = await Promise.all([
        fetchProductsWithVariants(),
        fetchAllSuppliers(),
      ]);
      setProducts(prods);
      setSuppliers(sups);
      calcStats(prods);
    } finally {
      setLoading(false);
    }
  }

  function calcStats(prods: PlGroupedProduct[]) {
    const s = { total: prods.length, pending: 0, active: 0, inactive: 0, rejected: 0 };
    prods.forEach((p) => {
      if (p.status === "pending") s.pending++;
      else if (p.status === "active") s.active++;
      else if (p.status === "inactive") s.inactive++;
      else if (p.status === "rejected") s.rejected++;
    });
    setStats(s);
  }

  const filtered = useMemo(() => {
    let list = [...products];
    if (supplierFilter !== "all") list = list.filter((p) => p.fk_owned_by === supplierFilter);
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.product_title.toLowerCase().includes(q));
    }
    return list;
  }, [products, supplierFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Open view modal ──
  function openView(product: PlGroupedProduct) {
    setViewProduct(product);
    const imgs = extractImages(product.image);
    setViewImages(imgs);
    setImageIdx(0);
    setLightbox(false);
    const priceMap = new Map<number, number>();
    const activeMap = new Map<number, boolean>();
    product.variants.forEach((v) => {
      priceMap.set(v.variant_id, v.price);
      activeMap.set(v.variant_id, v.active);
    });
    setEditPrices(priceMap);
    setEditActive(activeMap);
    setEditMsg("");
  }

  function closeView() {
    setViewProduct(null);
    setEditMsg("");
  }

  // ── Save changes ──
  async function saveVariantChanges() {
    if (!viewProduct || !userEmail) return;
    setSavingEdit(true);
    setEditMsg("");
    try {
      const supabase = createSupabaseClient();
      for (const variant of viewProduct.variants) {
        const newPrice = editPrices.get(variant.variant_id) ?? variant.price;
        const newActive = editActive.get(variant.variant_id) ?? variant.active;

        if (newPrice !== variant.price) {
          await createPriceHistoryEntry(
            viewProduct.product_id,
            variant.variant_id,
            variant.price,
            newPrice,
            userEmail
          );
        }

        if (newActive !== variant.active) {
          await createVariantStatusChangeRequest(
            viewProduct.product_id,
            variant.variant_id,
            variant.active,
            newActive,
            userEmail,
            "variant"
          );
        }
      }
      setEditMsg("Changes submitted for approval.");
      await loadAll();
    } catch {
      setEditMsg("Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Delete product ──
  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const ok = await deleteProduct(deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (ok) await loadAll();
  }

  const supplierName = useCallback(
    (code: string) => suppliers.find((s) => s.supplier_code === code)?.shop_name ?? code,
    [suppliers]
  );

  // ─── Stats cards ───────────────────────────────────────────────────────────
  const statCards = [
    { label: "Total", value: stats.total, color: "text-gray-700" },
    { label: "Pending", value: stats.pending, color: "text-yellow-700" },
    { label: "Active", value: stats.active, color: "text-green-700" },
    { label: "Inactive", value: stats.inactive, color: "text-gray-500" },
    { label: "Rejected", value: stats.rejected, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Products"
        subtitle="Browse and manage product listings"
        actions={
          <button
            type="button"
            onClick={() => router.push("/dashboard/product-listing/products/new")}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statCards.map((c) => (
          <div key={c.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          className="input"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
        >
          <option value="all">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.supplier_code} value={s.supplier_code}>
              {s.shop_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Package className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">No products found</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/product-listing/products/new")}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-center">Supplier</th>
                    <th className="px-4 py-3 text-center">Price</th>
                    <th className="px-4 py-3 text-center">Variants</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginated.map((product) => {
                    const thumb = getProductThumbnail(product);
                    return (
                      <tr key={product.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900 max-w-[180px]">
                                {product.product_title}
                              </p>
                              {product.brand_name && (
                                <p className="text-xs text-gray-400">{product.brand_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {supplierName(product.fk_owned_by)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium text-xs">
                          {(() => {
                            const prices = product.variants.map((v) => v.price).filter((p) => p > 0);
                            if (prices.length === 0) return <span className="text-gray-400">—</span>;
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {product.variants.length}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={product.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openView(product)}
                              className="btn-secondary inline-flex items-center gap-1 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(product.product_id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{filtered.length} products</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span>{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── View/Edit Modal ── */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeView}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-4 text-lg font-semibold text-gray-900 pr-8">
              {viewProduct.product_title}
            </h2>

            {/* Images */}
            {viewImages.length > 0 && (
              <div className="mb-4">
                <div
                  className="relative cursor-pointer overflow-hidden rounded-xl border border-gray-200"
                  onClick={() => setLightbox(true)}
                >
                  <img
                    src={viewImages[imageIdx]}
                    alt=""
                    className="h-48 w-full object-contain bg-gray-50"
                  />
                </div>
                {viewImages.length > 1 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {viewImages.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        onClick={() => setImageIdx(i)}
                        className={`h-12 w-12 shrink-0 cursor-pointer rounded-lg border-2 object-cover ${
                          i === imageIdx ? "border-portal-500" : "border-gray-200"
                        }`}
                        alt=""
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge status={viewProduct.status} />
              {viewProduct.brand_name && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {viewProduct.brand_name}
                </span>
              )}
            </div>

            {/* Variants */}
            {viewProduct.variants.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Variants</h3>
                {viewProduct.status !== "approved" && (
                  <p className="text-xs text-yellow-600 bg-yellow-50 rounded-lg px-3 py-1.5 border border-yellow-100">
                    Variant active status can only be changed once the product is approved.
                  </p>
                )}
                {viewProduct.variants.map((v) => (
                  <div key={v.variant_id} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-gray-800">
                        {v.option_values
                          ? formatVariantLabel(v.option_values)
                          : `Variant #${v.variant_id}`}
                      </div>
                      {viewProduct.status === "approved" ? (
                        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                          Active
                          <input
                            type="checkbox"
                            checked={editActive.get(v.variant_id) ?? v.active}
                            onChange={(e) => {
                              const next = new Map(editActive);
                              next.set(v.variant_id, e.target.checked);
                              setEditActive(next);
                            }}
                            className="h-4 w-4 rounded"
                          />
                        </label>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {v.active ? "Active" : "Inactive"}
                        </span>
                      )}
                    </div>
                    {v.option_values && (
                      <div className="flex flex-wrap gap-1">
                        {sortVariantOptionNames(Object.keys(v.option_values)).map((k) => (
                          <span key={k} className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                            {k}: {v.option_values![k]}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <span>Price:</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={editPrices.get(v.variant_id) ?? v.price}
                          onChange={(e) => {
                            const next = new Map(editPrices);
                            next.set(v.variant_id, parseFloat(e.target.value) || 0);
                            setEditPrices(next);
                          }}
                          className="input w-24 py-0.5 text-xs"
                        />
                      </div>
                      <div>Stock: <span className="font-medium">{v.stock}</span></div>
                      {v.sku && <div>SKU: <span className="font-medium">{v.sku}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editMsg && (
              <p className={`mb-3 text-sm ${editMsg.includes("Failed") ? "text-red-500" : "text-green-600"}`}>
                {editMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={closeView} className="btn-secondary">
                Close
              </button>
              {viewProduct.status === "approved" && (
                <button
                  type="button"
                  onClick={saveVariantChanges}
                  disabled={savingEdit}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && viewImages.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(false)}
        >
          <img
            src={viewImages[imageIdx]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Delete Product?</h3>
            <p className="text-sm text-gray-500">
              This will permanently delete the product and all its variants. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
