"use client";

import { useState, useEffect } from "react";
import type { Po } from "@/types/workflows";
import PODetailCard from "@/components/PODetailCard";
import AdminCreatorFilter from "@/components/AdminCreatorFilter";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function GrowthPurchaseOrdersPage() {
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<Po | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPos();
  }, [creatorFilter]);

  async function loadPos() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/growth/pos${params}`);
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPos(Array.isArray(data) ? data : []);
      } else {
        setPos([]);
      }
    } catch (error) {
      console.error("Failed to load POs:", error);
      setPos([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredPos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPos.map((po) => po.id)));
    }
  }

  function handleSelectOne(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  const safePos = Array.isArray(pos) ? pos : [];

  function downloadCSV() {
    const selectedPos = safePos.filter((po) => selectedIds.has(po.id));
    if (selectedPos.length === 0) {
      alert("Please select at least one PO to download");
      return;
    }

    const headers = [
      "PO Number",
      "PR Number",
      "Supplier Name",
      "Delivery Partner",
      "Status",
      "Created At"
    ];

    const rows = selectedPos.map((po) => {
      return [
        po.po_number || "-",
        po.pr?.pr_number ?? "-",
        po.supplier_name || "-",
        po.delivery_partner || "-",
        po.status?.replace(/_/g, " ") || "-",
        po.created_at ? new Date(po.created_at).toLocaleString() : "-"
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `purchase-orders-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredPos =
    statusFilter === "all"
      ? safePos
      : safePos.filter((po) => (po?.status ?? "") === statusFilter);

  const statusCounts = {
    all: safePos.length,
    order_placed: safePos.filter((p) => (p?.status ?? "") === "order_placed").length,
    shipment_at_supplier: safePos.filter((p) => (p?.status ?? "") === "shipment_at_supplier").length,
    delivered: safePos.filter((p) => (p?.status ?? "") === "delivered").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            My Purchase Orders
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <AdminCreatorFilter value={creatorFilter} onChange={setCreatorFilter} />
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
              Order Placed ({statusCounts.order_placed})
            </button>
            <button
              onClick={() => setStatusFilter("shipment_at_supplier")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "shipment_at_supplier"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              At Supplier ({statusCounts.shipment_at_supplier})
            </button>
            <button
              onClick={() => setStatusFilter("delivered")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "delivered"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Delivered ({statusCounts.delivered})
            </button>
          </div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : filteredPos.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No purchase orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredPos.length && filteredPos.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">
                    PO Number
                  </th>
                  <th className="px-3 py-3 text-left font-medium">PR Number</th>
                  <th className="px-3 py-3 text-left font-medium">Supplier</th>
                  <th className="px-3 py-3 text-left font-medium">
                    Delivery Partner
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">Created</th>
                  <th className="px-3 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPos.map((po) => {
                  return (
                    <tr
                      key={po.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(po.id)}
                          onChange={() => handleSelectOne(po.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        {po.po_number ? (
                          <span className="font-mono text-xs font-semibold text-gray-900">
                            {po.po_number}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {po.pr?.pr_number ? (
                          <span className="font-mono text-xs font-medium text-gray-900">
                            {po.pr.pr_number}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-900 font-medium">
                        {po.supplier_name}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700 text-xs">
                        {po.delivery_partner}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`badge capitalize ${
                            po.status === "delivered"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : po.status === "canceled"
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "border-blue-500 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {(po?.status ?? "").replace(/_/g, " ") || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-500 text-[10px]">
                        {formatDate(po.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <button
                          onClick={() => setSelectedPo(po)}
                          className="text-gray-700 hover:text-gray-900 transition-colors"
                          title="View Details"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedPo(null)}
        >
          <div
            className="card max-w-4xl w-full mx-4 border-gray-200 bg-white max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                PO Details
              </h3>
              <button
                onClick={() => setSelectedPo(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <PODetailCard po={selectedPo} showFullDetails />
          </div>
        </div>
      )}
    </div>
  );
}
