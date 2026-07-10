"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Warehouse } from "lucide-react";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import type { InventoryRow } from "@/lib/operations/inventory";
import { filterInventoryRows } from "@/lib/operations/inventory";

const ITEMS_PER_PAGE = 25;

export default function OperationsInventoryPage() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/inventory");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load inventory");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => filterInventoryRows(items, search),
    [items, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Inventory"
        subtitle="SKU inventory levels from Metabase"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by SKU, product name, or user ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full sm:w-72"
            />
            <button type="button" onClick={load} className="btn-secondary shrink-0" disabled={loading}>
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Warehouse className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {items.length === 0 ? "No inventory records found" : "No records match your search"}
          </p>
          {search.trim() && (
            <p className="mt-1 text-sm text-gray-400">
              SKU search matches by full SKU or the first 3–4 characters
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 text-center">User ID</th>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Product Name</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-center">Available Quantity</th>
                    <th className="px-4 py-3 text-center">Country</th>
                    <th className="px-4 py-3 text-center">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginated.map((row, idx) => (
                    <tr key={`${row.sku}-${row.user_id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center text-gray-700">{row.user_id}</td>
                      <td className="px-4 py-3 text-gray-600">{row.username}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.product_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.sku || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.available_quantity}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.country || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.category || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              {search.trim() ? ` matching "${search.trim()}"` : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  Previous
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
