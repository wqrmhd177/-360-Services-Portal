"use client";

import { useState, useEffect } from "react";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";

export default function GrowthPurchaseRequestsPage() {
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);

  useEffect(() => {
    loadPrs();
  }, []);

  async function loadPrs() {
    try {
      const res = await fetch("/api/growth/prs");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setPrs(data);
      } else {
        setPrs([]);
      }
    } catch (error) {
      console.error("Failed to load PRs:", error);
      setPrs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredPrs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPrs.map((pr) => pr.id)));
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

  const safePrs = Array.isArray(prs) ? prs : [];

  async function reopenPR(prId: string) {
    if (!confirm("Reopen this PR and send it back for approval?")) return;
    try {
      const res = await fetch(`/api/growth/pr/${prId}/reopen`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to reopen PR");
        return;
      }
      await loadPrs();
    } catch {
      alert("Failed to reopen PR");
    }
  }

  function downloadCSV() {
    const selectedPrs = safePrs.filter((pr) => selectedIds.has(pr.id));
    if (selectedPrs.length === 0) {
      alert("Please select at least one PR to download");
      return;
    }

    const headers = [
      "PR Number",
      "ID",
      "Product Name",
      "SKU Code",
      "Quantity",
      "Rate",
      "Amount",
      "Reseller Code",
      "Countries",
      "Shipping Type",
      "Movement Type",
      "Payment Method",
      "Approval Status",
      "Finance Verification Status",
      "PO Created",
      "Created At",
      "Updated At"
    ];

    const rows = selectedPrs.map((pr) => [
      pr.pr_number || pr.id,
      pr.id,
      pr.product_name || (pr.products && pr.products.length > 0 ? pr.products.map(p => p.productName).join(", ") : ""),
      pr.sku_code || (pr.products && pr.products.length > 0 ? pr.products.map(p => p.skuCode).join(", ") : ""),
      pr.quantity?.toString() || (pr.products && pr.products.length > 0 ? pr.products.reduce((sum, p) => sum + p.quantity, 0).toString() : "0"),
      pr.rate?.toString() || "",
      pr.amount?.toString() || (pr.products && pr.products.length > 0 ? pr.products.reduce((sum, p) => sum + p.totalAmount, 0).toString() : "0"),
      pr.reseller_code || pr.seller_channel_name || "",
      (pr.countries || []).join("; "),
      pr.shipping_type || "",
      pr.movement_type || "",
      pr.payment_method || pr.payment_type || "",
      pr.approval_status,
      pr.finance_verification_status,
      pr.po_created ? "Yes" : "No",
      pr.created_at ? new Date(pr.created_at).toLocaleString() : "",
      pr.updated_at ? new Date(pr.updated_at).toLocaleString() : ""
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `purchase-requests-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredPrs =
    statusFilter === "all"
      ? safePrs
      : statusFilter === "pending_approval"
      ? safePrs.filter((pr) => (pr?.approval_status ?? "") === "pending")
      : statusFilter === "approved"
      ? safePrs.filter((pr) => (pr?.approval_status ?? "") === "approved")
      : statusFilter === "finance_verified"
      ? safePrs.filter((pr) => (pr?.finance_verification_status ?? "") === "verified")
      : statusFilter === "po_created"
      ? safePrs.filter((pr) => !!pr?.po_created)
      : safePrs;

  const statusCounts = {
    all: safePrs.length,
    pending_approval: safePrs.filter((p) => (p?.approval_status ?? "") === "pending").length,
    approved: safePrs.filter((p) => (p?.approval_status ?? "") === "approved").length,
    finance_verified: safePrs.filter((p) => (p?.finance_verification_status ?? "") === "verified").length,
    po_created: safePrs.filter((p) => !!p?.po_created).length
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Purchase Request History</h2>
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
                  ? "border-portal-400 bg-portal-50 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusFilter("pending_approval")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "pending_approval"
                  ? "border-portal-400 bg-portal-50 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Pending Approval ({statusCounts.pending_approval})
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "approved"
                  ? "border-portal-400 bg-portal-50 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Approved ({statusCounts.approved})
            </button>
            <button
              onClick={() => setStatusFilter("finance_verified")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "finance_verified"
                  ? "border-portal-400 bg-portal-50 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Finance Verified ({statusCounts.finance_verified})
            </button>
            <button
              onClick={() => setStatusFilter("po_created")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "po_created"
                  ? "border-portal-400 bg-portal-50 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              PO Created ({statusCounts.po_created})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : filteredPrs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No purchase requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredPrs.length && filteredPrs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 bg-white"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">PR Number</th>
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Quantity</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Approval Status</th>
                  <th className="px-2 py-2 font-medium">Finance Status</th>
                  <th className="px-2 py-2 font-medium">PO Created</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrs.map((pr) => (
                  <tr
                    key={pr.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(pr.id)}
                        onChange={() => handleSelectOne(pr.id)}
                        className="rounded border-gray-300 bg-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      {pr.pr_number ? (
                        <span className="font-mono text-xs font-semibold text-gray-900">{pr.pr_number}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-900 font-medium">
                      {pr.products && pr.products.length > 0 
                        ? pr.products.length === 1
                          ? pr.products[0].productName
                          : `${pr.products[0].productName} (+${pr.products.length - 1} more)`
                        : pr.product_name || "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {pr.products && pr.products.length > 0
                        ? pr.products.length === 1
                          ? pr.products[0].skuCode
                          : `${pr.products[0].skuCode} (+${pr.products.length - 1})`
                        : pr.sku_code || "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-700">
                      {pr.products && pr.products.length > 0
                        ? pr.products.reduce((sum, p) => sum + p.quantity, 0)
                        : pr.quantity || "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-700 font-medium">
                      {pr.products && pr.products.length > 0
                        ? `${pr.products[0].currency} ${pr.products.reduce((sum, p) => sum + p.totalAmount, 0).toFixed(2)}`
                        : typeof pr.amount === "number" 
                          ? `AED ${pr.amount.toFixed(2)}` 
                          : "-"}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`badge ${
                          pr.approval_status === "approved"
                            ? "border-green-500 bg-green-50 text-green-700"
                            : pr.approval_status === "rejected"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-yellow-500 bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {pr.approval_status.charAt(0).toUpperCase() + pr.approval_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`badge ${
                          pr.finance_verification_status === "verified"
                            ? "border-green-500 bg-green-50 text-green-700"
                            : pr.finance_verification_status === "rejected"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-orange-500 bg-orange-50 text-orange-700"
                        }`}
                      >
                        {pr.finance_verification_status.charAt(0).toUpperCase() + pr.finance_verification_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`badge ${
                          pr.po_created
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-gray-300 bg-gray-50 text-gray-600"
                        }`}
                      >
                        {pr.po_created ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-500">
                      {pr.created_at
                        ? new Date(pr.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })
                        : "-"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPr(pr)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs font-medium"
                          title="View PR Details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {(pr.approval_status === "rejected" || pr.finance_verification_status === "rejected") && (
                          <button
                            type="button"
                            onClick={() => reopenPR(pr.id)}
                            className="inline-flex items-center gap-1 rounded border border-orange-400 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                            title="Reopen this PR"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* PR Detail Modal */}
      {selectedPr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedPr(null)}
        >
          <div
            className="card max-w-2xl w-full mx-4 border-gray-200 bg-white max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                PR Details{" "}
                {selectedPr.pr_number && (
                  <span className="text-sm font-mono text-gray-600">
                    ({selectedPr.pr_number})
                  </span>
                )}
              </h3>
              <button
                onClick={() => setSelectedPr(null)}
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
            <PRDetailCard pr={selectedPr} showFullDetails />
          </div>
        </div>
      )}
    </div>
  );
}
