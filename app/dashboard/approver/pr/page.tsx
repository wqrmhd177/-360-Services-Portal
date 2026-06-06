"use client";

import { useState, useEffect } from "react";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import ApproverPRActions from "./[id]/ApproverPRActions";
import CreatorFilterDropdown from "@/components/CreatorFilterDropdown";

// Format date as DD/MM/YYYY
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format time as HH:MM AM/PM
function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
}

export default function ApproverPurchaseRequestsPage() {
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPrs();
  }, [creatorFilter]);

  async function loadPrs() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/approver/prs${params}`);
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

  const safePrs = Array.isArray(prs) ? prs : [];

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
    const selectedPrs = safePrs.filter((pr) => selectedIds.has(pr.id));
    if (selectedPrs.length === 0) {
      alert("Please select at least one PR to download");
      return;
    }

    const headers = [
      "PR Number",
      "Product Name",
      "Amount",
      "Approval Status",
      "Finance Status",
      "Created At"
    ];

    const rows = selectedPrs.map((pr) => {
      return [
        pr.pr_number || "-",
        pr.product_name || "-",
        pr.amount?.toString() || "-",
        pr.approval_status?.replace(/_/g, " ") || "-",
        pr.finance_verification_status?.replace(/_/g, " ") || "-",
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
          <div className="flex flex-wrap items-center gap-3">
            <CreatorFilterDropdown value={creatorFilter} onChange={setCreatorFilter} />
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
              Pending ({statusCounts.pending})
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "approved"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Approved ({statusCounts.approved})
            </button>
            <button
              onClick={() => setStatusFilter("rejected")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "rejected"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Rejected ({statusCounts.rejected})
            </button>
          </div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : filteredPrs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No purchase requests found.</div>
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
                  <th className="px-3 py-3 text-left font-medium">PR Number</th>
                  <th className="px-3 py-3 text-left font-medium">Product</th>
                  <th className="px-3 py-3 text-left font-medium">Seller</th>
                  <th className="px-3 py-3 text-left font-medium">Product Details</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">Payment</th>
                  <th className="px-3 py-3 text-left font-medium">Created</th>
                  <th className="px-3 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrs.map((pr) => {
                  const products = pr.products || [];
                  const totalAmount = products.length > 0
                    ? products.reduce((sum, p) => sum + p.totalAmount, 0)
                    : pr.amount || 0;
                  const currency = products.length > 0 ? products[0].currency : "AED";
                  
                  return (
                    <tr
                      key={pr.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
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
                          <span className="font-mono text-xs font-semibold text-gray-900">{pr.pr_number}</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-900 font-medium">
                        <div className="text-xs">
                          {products.length > 0 ? (
                            <div className="space-y-1">
                              {products.map((product, idx) => (
                                <div key={idx} className="font-medium text-gray-900 leading-relaxed">
                                  {product.productName}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">{pr.product_name || "-"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle text-gray-700 text-xs">
                        {pr.seller_channel_name || pr.reseller_code || "-"}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700">
                        <div className="text-xs">
                          {products.length > 0 ? (
                            <div className="space-y-1">
                              {products.map((product, idx) => (
                                <div key={idx} className="text-[10px] leading-relaxed">
                                  {product.productName} → {product.destinationCountry} ({product.quantity} qty, {currency} {product.sellingPricePerUnit.toFixed(2)}/unit) - {product.shippingType} - {product.movementType}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500">No details</span>
                          )}
                        </div>
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
                          {pr.approval_status.charAt(0).toUpperCase() + pr.approval_status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-1 text-[10px]">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                            <div className="font-medium text-gray-900">
                              {currency} {totalAmount.toFixed(2)}
                            </div>
                            <div className="text-gray-700 capitalize">
                              {pr.payment_type || pr.payment_method || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-500 text-[10px] leading-relaxed">
                        {pr.created_at && pr.updated_at
                          ? (
                            <div className="space-y-0.5">
                              <div>Created:{formatDate(pr.created_at)}</div>
                              <div>Updated:{formatDate(pr.updated_at)} at {formatTime(pr.updated_at)}</div>
                            </div>
                          )
                          : pr.created_at
                          ? `Created:${formatDate(pr.created_at)}`
                          : "-"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2 justify-start">
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
