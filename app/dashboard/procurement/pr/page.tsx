"use client";

import { useState, useEffect } from "react";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function ProcurementPurchaseRequestsPage() {
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPrs();
  }, []);

  async function loadPrs() {
    try {
      const res = await fetch("/api/procurement/prs");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
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

  function downloadCSV() {
    const selectedPrs = prs.filter((pr) => selectedIds.has(pr.id));
    if (selectedPrs.length === 0) {
      alert("Please select at least one PR to download");
      return;
    }

    const headers = [
      "PR Number",
      "Product Name",
      "Seller",
      "Approval Status",
      "Finance Status",
      "PO Created",
      "Created At"
    ];

    const rows = selectedPrs.map((pr) => {
      const products = pr.products || [];
      const productLabel = products.length > 0
        ? products.length === 1
          ? products[0].productName
          : `${products[0].productName} (+${products.length - 1} more)`
        : pr.product_name || "-";

      return [
        pr.pr_number || "-",
        productLabel,
        pr.seller_channel_name || pr.reseller_code || "-",
        pr.approval_status || "-",
        pr.finance_verification_status || "-",
        pr.po_created ? "Yes" : "No",
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
      ? prs
      : statusFilter === "pending"
      ? prs.filter((pr) => pr.finance_verification_status === "pending")
      : statusFilter === "verified"
      ? prs.filter(
          (pr) =>
            pr.finance_verification_status === "verified" && !pr.po_created
        )
      : statusFilter === "po_created"
      ? prs.filter((pr) => pr.po_created)
      : prs;

  const statusCounts = {
    all: prs.length,
    pending: prs.filter((p) => p.finance_verification_status === "pending")
      .length,
    verified: prs.filter(
      (p) => p.finance_verification_status === "verified" && !p.po_created
    ).length,
    po_created: prs.filter((p) => p.po_created).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Purchase Requests
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
              onClick={() => setStatusFilter("pending")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "pending"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Pending verification ({statusCounts.pending})
            </button>
            <button
              onClick={() => setStatusFilter("verified")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "verified"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Verified – ready for PO ({statusCounts.verified})
            </button>
            <button
              onClick={() => setStatusFilter("po_created")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "po_created"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              PO created ({statusCounts.po_created})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : filteredPrs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No purchase requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredPrs.length && filteredPrs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">
                    PR Number
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Product</th>
                  <th className="px-3 py-3 text-left font-medium">Seller</th>
                  <th className="px-3 py-3 text-left font-medium">
                    Approver Status
                  </th>
                  <th className="px-3 py-3 text-left font-medium">
                    Finance Status
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Created</th>
                  <th className="px-3 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrs.map((pr) => {
                  const products = pr.products || [];
                  const productLabel =
                    products.length > 0
                      ? products.length === 1
                        ? products[0].productName
                        : `${products[0].productName} (+${products.length - 1} more)`
                      : pr.product_name || "-";
                  const isFullyApproved = pr.approval_status === "approved" && pr.finance_verification_status === "verified";
                  return (
                    <tr
                      key={pr.id}
                      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                        isFullyApproved && !pr.po_created ? "bg-green-50/30" : ""
                      }`}
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(pr.id)}
                          onChange={() => handleSelectOne(pr.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        {pr.pr_number ? (
                          <span className="font-mono text-xs font-semibold text-gray-900">
                            {pr.pr_number}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                        {isFullyApproved && !pr.po_created && (
                          <span className="ml-2 inline-flex items-center" title="Ready to convert to PO">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-900 font-medium">
                        {productLabel}
                      </td>
                      <td className="px-3 py-3 align-middle text-gray-700 text-xs">
                        {pr.seller_channel_name || pr.reseller_code || "-"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`badge capitalize ${
                            pr.approval_status === "approved"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : pr.approval_status === "rejected"
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "border-yellow-500 bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {pr.approval_status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`badge capitalize ${
                            pr.finance_verification_status === "verified"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : pr.finance_verification_status === "rejected"
                              ? "border-red-500 bg-red-50 text-red-700"
                              : "border-yellow-500 bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {pr.finance_verification_status}
                        </span>
                        {pr.po_created && (
                          <span className="ml-1 badge border-blue-500 bg-blue-50 text-blue-700 text-[10px]">
                            PO created
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-500 text-[10px]">
                        {formatDate(pr.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedPr(pr)}
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
                          
                          {/* Show Convert to PO button if both approvals are complete and PO not created */}
                          {isFullyApproved && !pr.po_created && (
                            <a
                              href={`/dashboard/procurement/pr/${pr.id}/convert`}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                              title="Convert to Purchase Order"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                                className="w-4 h-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                                />
                              </svg>
                              Convert to PO
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
