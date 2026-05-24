"use client";

import { useState } from "react";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import ApproverPRActions from "../../approver/pr/[id]/ApproverPRActions";

interface FinancePRTableProps {
  prs: Pr[];
}

export default function FinancePRTable({ prs }: FinancePRTableProps) {
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [selectedPrIds, setSelectedPrIds] = useState<Set<string>>(new Set());
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "approved" | "verified" | "rejected">("all");

  // Calculate counts
  const allCount = prs.length;
  const pendingCount = prs.filter(pr => pr.approval_status === "pending").length;
  const approvedCount = prs.filter(pr => pr.approval_status === "approved").length;
  const verifiedCount = prs.filter(pr => pr.finance_verification_status === "verified").length;
  const rejectedCount = prs.filter(pr => pr.approval_status === "rejected" || pr.finance_verification_status === "rejected").length;

  // Filter function
  const filteredPrs = prs.filter((pr) => {
    if (activeFilter === "pending" && pr.approval_status !== "pending") return false;
    if (activeFilter === "approved" && pr.approval_status !== "approved") return false;
    if (activeFilter === "verified" && pr.finance_verification_status !== "verified") return false;
    if (activeFilter === "rejected" && (pr.approval_status !== "rejected" && pr.finance_verification_status !== "rejected")) return false;
    return true;
  });

  function handleSelectAllPrs() {
    if (selectedPrIds.size === filteredPrs.length) {
      setSelectedPrIds(new Set());
    } else {
      setSelectedPrIds(new Set(filteredPrs.map((pr) => pr.id)));
    }
  }

  function handleSelectOnePr(id: string) {
    const newSelected = new Set(selectedPrIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPrIds(newSelected);
  }

  function downloadPrCSV() {
    const selectedPrs = filteredPrs.filter((pr) => selectedPrIds.has(pr.id));
    if (selectedPrs.length === 0) {
      alert("Please select at least one PR to download");
      return;
    }

    const headers = [
      "PR Number",
      "Product",
      "Amount",
      "Approval Status",
      "Finance Status",
      "Created At"
    ];

    const rows = selectedPrs.map((pr) => {
      const products = pr.products || [];
      const totalAmount = products.length > 0
        ? products.reduce((sum, p) => sum + p.totalAmount, 0)
        : pr.amount ?? 0;
      const currency = products.length > 0 ? products[0].currency : "AED";
      const productLabel = products.length > 0
        ? products.length === 1
          ? products[0].productName
          : `${products[0].productName} (+${products.length - 1} more)`
        : pr.product_name || "-";

      return [
        pr.pr_number || "-",
        productLabel,
        `${currency} ${typeof totalAmount === "number" ? totalAmount.toFixed(2) : totalAmount}`,
        pr.approval_status ?? "pending",
        pr.finance_verification_status ?? "pending",
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Purchase Requests
        </h2>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">All Purchase Requests</h3>
          <button onClick={downloadPrCSV} className="btn-secondary text-sm px-4 py-2">
            Download CSV ({selectedPrIds.size})
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setActiveFilter("all")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              activeFilter === "all"
                ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All ({allCount})
          </button>
          <button
            onClick={() => setActiveFilter("pending")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              activeFilter === "pending"
                ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setActiveFilter("approved")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              activeFilter === "approved"
                ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setActiveFilter("verified")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              activeFilter === "verified"
                ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            onClick={() => setActiveFilter("rejected")}
            className={`rounded-lg border px-3 py-1 text-xs ${
              activeFilter === "rejected"
                ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {filteredPrs.length === 0 ? (
          <p className="text-sm text-gray-400">No PRs found matching the filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">
                    <input
                      type="checkbox"
                      checked={selectedPrIds.size === filteredPrs.length && filteredPrs.length > 0}
                      onChange={handleSelectAllPrs}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Approval</th>
                  <th className="px-2 py-2 font-medium">Finance Status</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrs.map((pr) => {
                  const products = pr.products || [];
                  const totalAmount =
                    products.length > 0
                      ? products.reduce((sum, p) => sum + p.totalAmount, 0)
                      : pr.amount ?? 0;
                  const currency = products.length > 0 ? products[0].currency : "AED";
                  const productLabel =
                    products.length > 0
                      ? products.length === 1
                        ? products[0].productName
                        : `${products[0].productName} (+${products.length - 1} more)`
                      : pr.product_name || "-";
                  return (
                    <tr
                      key={pr.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedPrIds.has(pr.id)}
                          onChange={() => handleSelectOnePr(pr.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-900 font-medium">{productLabel}</td>
                      <td className="px-2 py-2 text-gray-700">
                        {currency}{" "}
                        {typeof totalAmount === "number" ? totalAmount.toFixed(2) : totalAmount}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`badge capitalize ${
                            pr.approval_status === "approved"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : pr.approval_status === "rejected"
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-yellow-500 bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {pr.approval_status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`badge capitalize ${
                            pr.finance_verification_status === "verified"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : pr.finance_verification_status === "rejected"
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-gray-300 bg-gray-50 text-gray-700"
                          }`}
                        >
                          {pr.finance_verification_status ?? "pending"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPr(pr)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                          title="View details"
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
                  <span className="text-sm font-mono text-gray-600">({selectedPr.pr_number})</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPr(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <ApproverPRActions prId={selectedPr.id} redirectPath="/dashboard/finance/purchase-requests" onSuccess={() => setSelectedPr(null)} />
              </div>
            )}
            {selectedPr.approval_status === "approved" && selectedPr.finance_verification_status === "pending" && (
              <div className="mt-4">
                <a
                  href={`/dashboard/finance/pr/${selectedPr.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Verify payment →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
