"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { Po, PoStatus } from "@/types/workflows";
import { Eye } from "lucide-react";

const statusLabels: Record<PoStatus, string> = {
  order_placed: "Order Placed",
  po_created: "Processing",
  shipment_at_supplier: "Shipment At Supplier WH",
  shipment_received_at_supplier_warehouse: "Shipment Received At Supplier Warehouse",
  shipment_received_at_lp_warehouse: "Shipment Received At LMP Warehouse",
  shipment_received_at_destination_city: "Shipment Received At Destination City",
  shipment_received_at_destination_warehouse: "Shipment At Destination Country",
  delivered: "Delivered",
  canceled: "Canceled"
};

interface PurchaseOrdersClientProps {
  initialPos: Po[];
}

export default function PurchaseOrdersClient({ initialPos }: PurchaseOrdersClientProps) {
  const [allPos, setAllPos] = useState<Po[]>(Array.isArray(initialPos) ? initialPos : []);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // If server passed empty list, load from API (fallback, no cache)
  useEffect(() => {
    if (allPos.length > 0) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch("/api/procurement/pos", { cache: "no-store" })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) {
          setLoadError(`Could not load POs: ${res.status} ${res.statusText}`);
          console.warn("[Purchase Orders] Fallback API failed:", res.status, res.statusText);
          setAllPos([]);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || data === null) return;
        const list = data?.pos ?? data;
        const arr = Array.isArray(list) ? list : [];
        setAllPos(arr);
        if (arr.length === 0) {
          console.warn("[Purchase Orders] Fallback API returned 0 POs (database may have no POs).");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAllPos([]);
          setLoadError("Failed to load purchase orders. Check the console for details.");
          console.warn("[Purchase Orders] Fallback fetch error:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allPos.length]);

  const filteredPos =
    statusFilter === "all"
      ? allPos
      : allPos.filter((po) => po.status === statusFilter);

  const statusCounts = {
    all: allPos.length,
    order_placed: allPos.filter((p) => p.status === "order_placed").length,
    po_created: allPos.filter((p) => p.status === "po_created").length,
    shipment_at_supplier: allPos.filter((p) => p.status === "shipment_at_supplier").length,
    shipment_received_at_lp_warehouse: allPos.filter((p) => p.status === "shipment_received_at_lp_warehouse").length,
    shipment_received_at_destination_warehouse: allPos.filter((p) => p.status === "shipment_received_at_destination_warehouse").length,
    delivered: allPos.filter((p) => p.status === "delivered").length,
    canceled: allPos.filter((p) => p.status === "canceled").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Purchase Orders</h2>
          <p className="text-sm text-gray-500">
            View and manage all purchase orders with supplier and delivery partner details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/procurement/po/new" className="btn-primary">
            Create New PO
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "all"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusFilter("order_placed")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "order_placed"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.order_placed} ({statusCounts.order_placed})
            </button>
            <button
              onClick={() => setStatusFilter("po_created")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "po_created"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.po_created} ({statusCounts.po_created})
            </button>
            <button
              onClick={() => setStatusFilter("shipment_at_supplier")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "shipment_at_supplier"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.shipment_at_supplier} ({statusCounts.shipment_at_supplier})
            </button>
            <button
              onClick={() => setStatusFilter("shipment_received_at_lp_warehouse")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "shipment_received_at_lp_warehouse"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.shipment_received_at_lp_warehouse} ({statusCounts.shipment_received_at_lp_warehouse})
            </button>
            <button
              onClick={() => setStatusFilter("shipment_received_at_destination_warehouse")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "shipment_received_at_destination_warehouse"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.shipment_received_at_destination_warehouse} ({statusCounts.shipment_received_at_destination_warehouse})
            </button>
            <button
              onClick={() => setStatusFilter("delivered")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "delivered"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.delivered} ({statusCounts.delivered})
            </button>
            <button
              onClick={() => setStatusFilter("canceled")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "canceled"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {statusLabels.canceled} ({statusCounts.canceled})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : filteredPos.length === 0 ? (
          <div className="py-12 text-center">
            {loadError && (
              <p className="mb-2 text-sm font-medium text-amber-700">{loadError}</p>
            )}
            <p className="text-sm text-gray-500">No Purchase Orders yet.</p>
            <Link href="/dashboard/procurement/po/new" className="mt-4 inline-block text-sm text-gray-900 hover:underline">
              Create your first PO →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-3 py-3 font-medium">PO Number</th>
                  <th className="px-3 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Growth User</th>
                  <th className="px-3 py-3 font-medium">Supplier</th>
                  <th className="px-3 py-3 font-medium">Delivery Partner</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPos.map((po: any) => (
                  <tr key={po.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-900">
                      {po.po_number ? (
                        <span className="font-mono text-xs font-semibold text-gray-900">{po.po_number}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-900">{po.product_names || "-"}</td>
                    <td className="px-3 py-3 text-gray-900">{po.creator_name || "-"}</td>
                    <td className="px-3 py-3 text-gray-900">{po.supplier_name}</td>
                    <td className="px-3 py-3 text-gray-900">{po.delivery_partner}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                        {statusLabels[po?.status as PoStatus] || (po?.status ?? "").replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {po.created_at
                        ? new Date(po.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })
                        : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/dashboard/procurement/po/${po.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-100 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
