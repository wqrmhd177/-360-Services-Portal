"use client";

import { useState, useEffect } from "react";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import ApproverPRActions from "../pr/[id]/ApproverPRActions";

export default function ApproverPurchaseRequestPage() {
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const safePrs = Array.isArray(prs) ? prs : [];

  useEffect(() => {
    loadPrs();
  }, []);

  async function loadPrs() {
    try {
      const res = await fetch("/api/approver/prs");
      if (res.ok) {
        const data = await res.json();
        const list = data?.prs ?? data;
        setPrs(Array.isArray(list) ? list : []);
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
      setSelectedIds(new Set(filteredPrs.map((pr: Pr) => pr.id)));
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

  function downloadCSV() {
    const selectedPrs = safePrs.filter((pr) => selectedIds.has(pr.id));
    if (selectedPrs.length === 0) {
      alert("Please select at least one PR to download");
      return;
    }

    const headers = [
      "PR Number",
      "Product Name",
      "SKU",
      "Quantity",
      "Amount",
      "Approval Status",
      "Approved By",
      "Created At"
    ];

    const rows = selectedPrs.map((pr) => {
      const productName = pr.products && pr.products.length > 0
        ? pr.products.length === 1
          ? pr.products[0].productName
          : `${pr.products[0].productName} (+${pr.products.length - 1} more)`
        : pr.product_name || "-";
      const skuCode = pr.products && pr.products.length > 0
        ? pr.products.length === 1
          ? pr.products[0].skuCode
          : `${pr.products[0].skuCode} (+${pr.products.length - 1})`
        : pr.sku_code || "-";
      const quantity = pr.products && pr.products.length > 0
        ? pr.products.reduce((sum, p) => sum + p.quantity, 0)
        : pr.quantity || 0;
      const amount = pr.products && pr.products.length > 0
        ? `${pr.products[0].currency} ${pr.products.reduce((sum, p) => sum + p.totalAmount, 0).toFixed(2)}`
        : typeof pr.amount === "number"
          ? `AED ${pr.amount.toFixed(2)}`
          : "-";

      return [
        pr.pr_number || "-",
        productName,
        skuCode,
        quantity.toString(),
        amount,
        pr.approval_status || "-",
        pr.approved_by_email || "-",
        pr.created_at ? new Date(pr.created_at).toLocaleString() : "-"
      ];
    });

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
      : statusFilter === "pending"
      ? safePrs.filter((pr) => pr.approval_status === "pending")
      : statusFilter === "approved"
      ? safePrs.filter((pr) => pr.approval_status === "approved")
      : statusFilter === "rejected"
      ? safePrs.filter((pr) => pr.approval_status === "rejected")
      : safePrs;

  const statusCounts = {
    all: safePrs.length,
    pending: safePrs.filter((p) => p.approval_status === "pending").length,
    approved: safePrs.filter((p) => p.approval_status === "approved").length,
    rejected: safePrs.filter((p) => p.approval_status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Purchase Request</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
            onClick={() => setStatusFilter("pending")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              statusFilter === "pending"
                ? "border-yellow-500 bg-yellow-50 text-yellow-700 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Pending ({statusCounts.pending})
          </button>
          <button
            onClick={() => setStatusFilter("approved")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              statusFilter === "approved"
                ? "border-green-500 bg-green-50 text-green-700 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Approved ({statusCounts.approved})
          </button>
          <button
            onClick={() => setStatusFilter("rejected")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              statusFilter === "rejected"
                ? "border-red-500 bg-red-50 text-red-700 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Rejected ({statusCounts.rejected})
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
        ) : filteredPrs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No PRs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredPrs.length && filteredPrs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">PR Number</th>
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Qty</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Approval Status</th>
                  <th className="px-2 py-2 font-medium">Approved By</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrs.map((pr) => {
                  const productName = pr.products && pr.products.length > 0
                    ? pr.products.length === 1
                      ? pr.products[0].productName
                      : `${pr.products[0].productName} (+${pr.products.length - 1} more)`
                    : pr.product_name || "-";
                  const skuCode = pr.products && pr.products.length > 0
                    ? pr.products.length === 1
                      ? pr.products[0].skuCode
                      : `${pr.products[0].skuCode} (+${pr.products.length - 1})`
                    : pr.sku_code || "-";
                  const quantity = pr.products && pr.products.length > 0
                    ? pr.products.reduce((sum, p) => sum + p.quantity, 0)
                    : pr.quantity || 0;
                  const amount = pr.products && pr.products.length > 0
                    ? `${pr.products[0].currency} ${pr.products.reduce((sum, p) => sum + p.totalAmount, 0).toFixed(2)}`
                    : typeof pr.amount === "number"
                      ? `AED ${pr.amount.toFixed(2)}`
                      : "-";
                  
                  return (
                    <tr key={pr.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(pr.id)}
                          onChange={() => handleSelectOne(pr.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className="font-mono text-xs font-semibold text-gray-900">{pr.pr_number || "-"}</span>
                      </td>
                      <td className="px-2 py-2 text-gray-900 font-medium">{productName}</td>
                      <td className="px-2 py-2 text-gray-700">{skuCode}</td>
                      <td className="px-2 py-2 text-gray-700">{quantity}</td>
                      <td className="px-2 py-2 text-gray-700 font-medium">{amount}</td>
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
                          {(pr.approval_status ?? "").charAt(0).toUpperCase() + (pr.approval_status ?? "").slice(1) || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-gray-700">
                        {pr.approved_by_email || "-"}
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
                      </td>
                    </tr>
                  );
                })}
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
            {selectedPr.approval_status === "pending" && (
              <div className="mt-6">
                <ApproverPRActions prId={selectedPr.id} onSuccess={() => setSelectedPr(null)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
