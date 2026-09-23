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
import type { PlSupplier, PlSupplierWithCount } from "@/lib/productListing/types";

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
      const [supRes, prodRes] = await Promise.all([
        fetch("/api/product-listing/action"),
        fetch("/api/product-listing/products"),
      ]);
      const supJson = supRes.ok ? await supRes.json() : { suppliers: [] };
      const prodJson = prodRes.ok ? await prodRes.json() : { products: [] };
      if (!supRes.ok) {
        throw new Error(supJson.error || "Failed to load suppliers");
      }

      const approved = ((supJson.suppliers ?? []) as PlSupplier[]).filter(
        (supplier) => supplier.status === "approved" && !supplier.archived,
      );

      const countByCode = new Map<string, number>();
      for (const product of prodJson.products ?? []) {
        const code = String(product.fk_owned_by ?? "").trim();
        if (!code) continue;
        countByCode.set(code, (countByCode.get(code) ?? 0) + 1);
      }

      setSuppliers(
        approved.map((supplier) => ({
          ...supplier,
          productCount: countByCode.get(supplier.supplier_code) ?? 0,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suppliers");
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

      <div className="relative max-w-md">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="input w-full pl-9"
        />
        <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Package className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-base font-medium text-gray-600">No suppliers found</p>
        </div>
      ) : (
        <>
          <div className="card hidden overflow-hidden p-0 md:block">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-center">Products</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginated.map((supplier) => (
                  <tr key={supplier.supplier_code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{supplier.shop_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {supplier.supplier_code}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {supplier.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {supplier.productCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {paginated.map((supplier) => (
              <div key={supplier.supplier_code} className="card p-4">
                <div className="font-medium text-gray-900">{supplier.shop_name}</div>
                <div className="mt-1 font-mono text-xs text-gray-500">{supplier.supplier_code}</div>
                <div className="mt-2 text-sm text-gray-600">{supplier.phone}</div>
                <div className="mt-2 text-xs text-gray-500">
                  {supplier.productCount ?? 0} products
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
