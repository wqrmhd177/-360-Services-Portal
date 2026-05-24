"use client";

import { useState } from "react";
import type { Pr, Po } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import PODetailCard from "@/components/PODetailCard";
import ApproverPRActions from "../../approver/pr/[id]/ApproverPRActions";

interface FinancePRTableWithModalProps {
  prs: Pr[];
  pos: Po[];
}

export default function FinancePRTableWithModal({ prs, pos }: FinancePRTableWithModalProps) {
  const [activeTab, setActiveTab] = useState<"pr" | "po">("pr");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [selectedPo, setSelectedPo] = useState<Po | null>(null);
  const [selectedPrIds, setSelectedPrIds] = useState<Set<string>>(new Set());
  const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [prApprovalFilter, setPrApprovalFilter] = useState<string>("all");
  const [prFinanceFilter, setPrFinanceFilter] = useState<string>("all");
  const [poSupplierPaymentFilter, setPoSupplierPaymentFilter] = useState<string>("all");
  const [poDeliveryPaymentFilter, setPoDeliveryPaymentFilter] = useState<string>("all");

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

  function handleSelectAllPos() {
    if (selectedPoIds.size === filteredPos.length) {
      setSelectedPoIds(new Set());
    } else {
      setSelectedPoIds(new Set(filteredPos.map((po) => po.id)));
    }
  }

  function handleSelectOnePo(id: string) {
    const newSelected = new Set(selectedPoIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPoIds(newSelected);
  }

  // Filter functions
  const filteredPrs = prs.filter((pr) => {
    if (prApprovalFilter !== "all" && pr.approval_status !== prApprovalFilter) return false;
    if (prFinanceFilter !== "all" && pr.finance_verification_status !== prFinanceFilter) return false;
    return true;
  });

  const filteredPos = pos.filter((po) => {
    if (poSupplierPaymentFilter !== "all" && po.supplier_payment_status !== poSupplierPaymentFilter) return false;
    if (poDeliveryPaymentFilter !== "all" && po.delivery_partner_payment_status !== poDeliveryPaymentFilter) return false;
    return true;
  });

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

  function downloadPoCSV() {
    const selectedPos = filteredPos.filter((po) => selectedPoIds.has(po.id));
    if (selectedPos.length === 0) {
      alert("Please select at least one PO to download");
      return;
    }

    const headers = [
      "PO Number",
      "Supplier",
      "Supplier Payment Status",
      "Delivery Payment Status",
      "Created At"
    ];

    const rows = selectedPos.map((po) => {
      return [
        po.po_number || "-",
        po.supplier_name || "-",
        po.supplier_payment_status || "-",
        po.delivery_partner_payment_status || "-",
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Purchase History
        </h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("pr")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === "pr"
                ? "border-portal-400 text-portal-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Purchase Requests
          </button>
          <button
            onClick={() => setActiveTab("po")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === "po"
                ? "border-portal-400 text-portal-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Purchase Orders
          </button>
        </nav>
      </div>

      {/* Purchase Requests Tab */}
      {activeTab === "pr" && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Purchase Requests</h3>
            <button onClick={downloadPrCSV} className="btn-secondary text-sm px-4 py-2">
              Download CSV ({selectedPrIds.size})
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Approval:</label>
              <select
                value={prApprovalFilter}
                onChange={(e) => setPrApprovalFilter(e.target.value)}
                className="rounded-md border-gray-300 text-sm focus:border-portal-400 focus:ring-portal-400"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Finance Status:</label>
              <select
                value={prFinanceFilter}
                onChange={(e) => setPrFinanceFilter(e.target.value)}
                className="rounded-md border-gray-300 text-sm focus:border-portal-400 focus:ring-portal-400"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={() => {
                setPrApprovalFilter("all");
                setPrFinanceFilter("all");
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear Filters
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
      )}

      {/* Purchase Orders Tab */}
      {activeTab === "po" && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
            <button onClick={downloadPoCSV} className="btn-secondary text-sm px-4 py-2">
              Download CSV ({selectedPoIds.size})
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Supplier Payment:</label>
              <select
                value={poSupplierPaymentFilter}
                onChange={(e) => setPoSupplierPaymentFilter(e.target.value)}
                className="rounded-md border-gray-300 text-sm focus:border-portal-400 focus:ring-portal-400"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Delivery Payment:</label>
              <select
                value={poDeliveryPaymentFilter}
                onChange={(e) => setPoDeliveryPaymentFilter(e.target.value)}
                className="rounded-md border-gray-300 text-sm focus:border-portal-400 focus:ring-portal-400"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            <button
              onClick={() => {
                setPoSupplierPaymentFilter("all");
                setPoDeliveryPaymentFilter("all");
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear Filters
            </button>
          </div>

          {filteredPos.length === 0 ? (
            <p className="text-sm text-gray-400">No POs found matching the filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedPoIds.size === filteredPos.length && filteredPos.length > 0}
                        onChange={handleSelectAllPos}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-2 py-2 font-medium">PO Number</th>
                    <th className="px-2 py-2 font-medium">Supplier</th>
                    <th className="px-2 py-2 font-medium">Supplier Payment</th>
                    <th className="px-2 py-2 font-medium">Delivery Payment</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPos.map((po) => (
                    <tr key={po.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedPoIds.has(po.id)}
                          onChange={() => handleSelectOnePo(po.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-900">
                        {po.po_number ? (
                          <span className="font-mono text-xs font-semibold text-gray-900">
                            {po.po_number}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-gray-900 font-medium">{po.supplier_name}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`badge ${
                            po.supplier_payment_status === "paid"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-red-500 bg-red-50 text-red-700"
                          }`}
                        >
                          {po.supplier_payment_status === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`badge ${
                            po.delivery_partner_payment_status === "paid"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : "border-red-500 bg-red-50 text-red-700"
                          }`}
                        >
                          {po.delivery_partner_payment_status === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPo(po)}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PR Detail Modal (eye view) */}
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
                <ApproverPRActions prId={selectedPr.id} redirectPath="/dashboard/finance/history" onSuccess={() => setSelectedPr(null)} />
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

      {/* PO Detail Modal (eye view) */}
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
                PO Details{" "}
                {selectedPo.po_number && (
                  <span className="text-sm font-mono text-gray-600">({selectedPo.po_number})</span>
                )}
              </h3>
              <button
                onClick={() => setSelectedPo(null)}
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
            <PODetailCard po={selectedPo} showFullDetails />
          </div>
        </div>
      )}
    </div>
  );
}
