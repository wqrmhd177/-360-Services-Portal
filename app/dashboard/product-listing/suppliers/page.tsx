"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Package,
  Phone,
  Loader2,
} from "lucide-react";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import {
  fetchApprovedSuppliers,
  getProductCountForSupplier,
} from "@/lib/productListing/supplierHelpers";
import type { PlSupplierWithCount } from "@/lib/productListing/types";

const ITEMS_PER_PAGE = 25;

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<PlSupplierWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
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
      const list = await fetchApprovedSuppliers();
      const withCounts = await Promise.all(
        list.map(async (s) => ({
          ...s,
          productCount: await getProductCountForSupplier(s.supplier_code),
        }))
      );
      setSuppliers(withCounts);
    } catch {
      setError("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.shop_name?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.supplier_code?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Suppliers"
        subtitle="Approved supplier records for Product Listing"
        actions={
          <button
            type="button"
            onClick={() => router.push("/dashboard/product-listing/suppliers/new")}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        }
      />

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          
          <input
            type="text"
            placeholder="Search by name, phone or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full"
          />
        </div>
      </div>

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
          <Users className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {suppliers.length === 0 ? "No approved suppliers yet" : "No suppliers found"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {suppliers.length === 0
              ? "Add a supplier — they will appear here once approved"
              : "Try a different search term"}
          </p>
          {suppliers.length === 0 && (
            <button
              type="button"
              onClick={() => router.push("/dashboard/product-listing/suppliers/new")}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Supplier
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((s) => (
              <div
                key={s.id}
                className="card cursor-pointer p-5 transition-shadow hover:shadow-md"
                onClick={() =>
                  router.push(`/dashboard/product-listing/products?supplier=${s.supplier_code}`)
                }
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {s.shop_name}
                    </h3>
                    <span className="text-xs text-gray-400">{s.supplier_code}</span>
                  </div>
                </div>

                <div className="mb-4 space-y-1.5">
                  {s.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{s.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">{s.productCount} products</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/dashboard/product-listing/products?supplier=${s.supplier_code}`
                      );
                    }}
                    className="btn-secondary text-xs"
                  >
                    View Products
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {filtered.length} supplier{filtered.length !== 1 ? "s" : ""}
              </span>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
