"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { Qr } from "@/types/workflows";
import { formatQrStatusLabel } from "@/lib/format";

export default function ProcurementQuotationRequestsPage() {
  const [qrs, setQrs] = useState<Qr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadQrs();
  }, []);

  async function loadQrs() {
    try {
      const res = await fetch("/api/procurement/qrs");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const list = data?.qrs ?? data;
        setQrs(Array.isArray(list) ? list : []);
      } else {
        setQrs([]);
      }
    } catch (error) {
      console.error("Failed to load QRs:", error);
      setQrs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredQrs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQrs.map((qr) => qr.id)));
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

  const safeQrs = Array.isArray(qrs) ? qrs : [];

  function downloadCSV() {
    const selectedQrs = safeQrs.filter((qr) => selectedIds.has(qr.id));
    if (selectedQrs.length === 0) {
      alert("Please select at least one QR to download");
      return;
    }

    const headers = [
      "QR Number",
      "Product Name",
      "Customer Code",
      "Quantity",
      "Countries",
      "Status",
      "Created At"
    ];

    const rows = selectedQrs.map((qr) => {
      const productNames = qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
        ? qr.purchase_details.map((d: any) => d.productName).join(" | ")
        : "-";
      const quantity = qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
        ? qr.purchase_details.reduce((sum: number, d: any) => sum + (d.quantity || 0), 0)
        : 0;
      const countries = qr.countries && qr.countries.length > 0
        ? qr.countries.join(", ")
        : "-";

      return [
        qr.qr_number || "-",
        productNames,
        qr.reseller_code || "-",
        quantity.toString(),
        countries,
        (formatQrStatusLabel(qr.status) === "—" ? "-" : formatQrStatusLabel(qr.status)),
        qr.created_at ? new Date(qr.created_at).toLocaleString() : "-"
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `quotation-requests-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredQrs =
    statusFilter === "all"
      ? safeQrs
      : safeQrs.filter((q) => (q?.status ?? "") === statusFilter);

  const statusCounts = {
    all: safeQrs.length,
    open: safeQrs.filter((q) => (q?.status ?? "") === "open").length,
    responded: safeQrs.filter((q) => (q?.status ?? "") === "responded").length,
    converted_to_pr: safeQrs.filter((q) => (q?.status ?? "") === "converted_to_pr").length,
    canceled: safeQrs.filter((q) => (q?.status ?? "") === "canceled").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Quotation Requests</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
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
              onClick={() => setStatusFilter("open")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "open"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Open ({statusCounts.open})
            </button>
            <button
              onClick={() => setStatusFilter("responded")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "responded"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Responded ({statusCounts.responded})
            </button>
            <button
              onClick={() => setStatusFilter("converted_to_pr")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "converted_to_pr"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Converted to PR ({statusCounts.converted_to_pr})
            </button>
            <button
              onClick={() => setStatusFilter("canceled")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "canceled"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Canceled ({statusCounts.canceled})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : filteredQrs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No quotation requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredQrs.length && filteredQrs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">QR Number</th>
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">Qty</th>
                  <th className="px-2 py-2 font-medium">Countries</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredQrs.map((qr) => (
                  <tr
                    key={qr.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(qr.id)}
                        onChange={() => handleSelectOne(qr.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-2 py-2">
                      {qr.qr_number ? (
                        <span className="font-mono text-xs font-semibold text-gray-900">{qr.qr_number}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-900 font-medium">
                      {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
                        ? qr.purchase_details.map((d: any) => d.productName).join(", ")
                        : "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
                        ? qr.purchase_details.reduce((sum: number, d: any) => sum + (d.quantity || 0), 0)
                        : "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {qr.countries && qr.countries.length > 0
                        ? qr.countries.join(", ")
                        : "-"}
                    </td>
                    <td className="px-2 py-2">
                      <span className="badge">{formatQrStatusLabel(qr?.status)}</span>
                    </td>
                    <td className="px-2 py-2 text-gray-500">
                      {qr.created_at
                        ? new Date(qr.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })
                        : "-"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {qr.status === "open" ? (
                        <Link
                          href={`/dashboard/procurement/qr/${qr.id}/respond`}
                          className="text-xs font-medium text-gray-900 hover:text-gray-700"
                        >
                          Respond
                        </Link>
                      ) : qr.status === "responded" ? (
                        <Link
                          href={`/dashboard/procurement/qr/${qr.id}/respond`}
                          className="text-xs font-medium text-gray-700 hover:text-gray-900"
                        >
                          View Response
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
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
