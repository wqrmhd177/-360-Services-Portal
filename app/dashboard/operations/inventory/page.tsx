"use client";

import { Loader2, RefreshCw, Warehouse } from "lucide-react";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { ListPagination, SyncStatusBar } from "@/components/lists/ListPagination";
import { useOperationsListPage } from "@/hooks/useOperationsListPage";
import type { InventoryRow } from "@/lib/operations/inventory";

export default function OperationsInventoryPage() {
  const {
    items,
    loading,
    syncing,
    bootstrapping,
    error,
    warning,
    search,
    setSearch,
    currentPage,
    setCurrentPage,
    totalPages,
    total,
    lastSyncedAt,
    runSync,
  } = useOperationsListPage<InventoryRow>({
    apiPath: "/api/operations/inventory",
    syncPath: "/api/operations/inventory/sync",
    itemsKey: "items",
  });

  const busy = loading || syncing || bootstrapping;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Inventory"
        subtitle="SKU inventory cached in Supabase for fast multi-user access"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by SKU, product name, or user ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full sm:w-72"
            />
            <button
              type="button"
              onClick={runSync}
              disabled={busy}
              className="btn-primary inline-flex shrink-0 items-center gap-2 disabled:opacity-60"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync
            </button>
          </div>
        }
      />

      <SyncStatusBar
        lastSyncedAt={lastSyncedAt}
        syncing={syncing}
        bootstrapping={bootstrapping}
        warning={warning}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {busy && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-portal-500" />
          <p className="text-sm text-gray-600">
            {bootstrapping ? "Loading initial inventory from Metabase…" : "Loading inventory…"}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Warehouse className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {total === 0 && !search.trim()
              ? "No inventory records found"
              : "No records match your search"}
          </p>
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
                  {items.map((row, idx) => (
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

          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemLabel="records"
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
