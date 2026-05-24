"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import ApproverPRActions from "./pr/[id]/ApproverPRActions";

interface GrowthPerformanceRow {
  growthUserEmail: string;
  growthUserName: string;
  quotationRequestsCount: number;
  approvedPrCount: number;
  deliveredPoCount: number;
  inprocessPoCount: number;
  deliveredPoAmountAed: number;
  inprocessPoAmountAed: number;
  totalAmountAed: number;
  deliveredPoMarginAed: number;
  inprocessPoMarginAed: number;
  totalMarginAed: number;
}

export default function ApproverDashboardPage() {
  const [pendingPrs, setPendingPrs] = useState<Pr[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [performanceRows, setPerformanceRows] = useState<GrowthPerformanceRow[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPerformanceData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch("/api/approver/prs");
      if (res.ok) {
        const data = await res.json();
        const allPrs: Pr[] = data.prs || data || [];
        setPendingPrs(allPrs.filter((pr) => pr.approval_status === "pending"));
        setApprovedCount(allPrs.filter((pr) => pr.approval_status === "approved").length);
      }
    } catch (error) {
      console.error("Failed to load PRs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformanceData() {
    try {
      const res = await fetch("/api/approver/growth-performance");
      if (res.ok) {
        const data = await res.json();
        setPerformanceRows(data.rows ?? []);
      }
    } catch (error) {
      console.error("Failed to load growth performance:", error);
    } finally {
      setPerformanceLoading(false);
    }
  }

  const pendingCount = pendingPrs.length;

  function formatAed(amount: number) {
    return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Approver Workspace</h2>
        <p className="text-sm text-gray-500">
          Review and approve Purchase Requests (PRs). You can view read-only QR details linked to
          PRs, but cannot edit them. Approved PRs move forward to Finance and Procurement.
        </p>
      </div>

      {/* Growth Team Performance Dashboard */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Growth Team Performance</h3>
            <p className="mt-1 text-sm text-gray-600">
              Performance metrics for Growth team members. Amounts shown in AED.
            </p>
          </div>
        </div>
        {performanceLoading ? (
          <p className="text-sm text-gray-500">Loading performance data...</p>
        ) : performanceRows.length === 0 ? (
          <p className="text-sm text-gray-500">No Growth team data available.</p>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Growth User Name</th>
                  <th className="px-3 py-3 font-semibold">Quotation Requests</th>
                  <th className="px-3 py-3 font-semibold">Approved PRs</th>
                  <th className="px-3 py-3 font-semibold">Delivered POs</th>
                  <th className="px-3 py-3 font-semibold">Inprocess POs</th>
                  <th className="px-3 py-3 font-semibold">Delivered POs Amount</th>
                  <th className="px-3 py-3 font-semibold">Inprocess PO Amount</th>
                  <th className="px-3 py-3 font-semibold">Total Amount</th>
                  <th className="px-3 py-3 font-semibold">Delivered POs Margin</th>
                  <th className="px-3 py-3 font-semibold">Inprocess PO Margin</th>
                  <th className="px-3 py-3 font-semibold">Total Margin</th>
                </tr>
              </thead>
              <tbody>
                {performanceRows.map((row, idx) => (
                  <tr
                    key={row.growthUserEmail}
                    className={`border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-all ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-gray-900 text-left">
                      {row.growthUserName}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{row.quotationRequestsCount}</td>
                    <td className="px-3 py-3 text-gray-700">{row.approvedPrCount}</td>
                    <td className="px-3 py-3 text-gray-700">{row.deliveredPoCount}</td>
                    <td className="px-3 py-3 text-gray-700">{row.inprocessPoCount}</td>
                    <td className="px-3 py-3 font-medium text-green-700">
                      {formatAed(row.deliveredPoAmountAed)}
                    </td>
                    <td className="px-3 py-3 font-medium text-amber-700">
                      {formatAed(row.inprocessPoAmountAed)}
                    </td>
                    <td className="px-3 py-3 font-bold text-gray-900">
                      {formatAed(row.totalAmountAed)}
                    </td>
                    <td className="px-3 py-3 font-medium text-green-700">
                      {formatAed(row.deliveredPoMarginAed)}
                    </td>
                    <td className="px-3 py-3 font-medium text-amber-700">
                      {formatAed(row.inprocessPoMarginAed)}
                    </td>
                    <td className="px-3 py-3 font-bold text-gray-900">
                      {formatAed(row.totalMarginAed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card border-l-4 border-blue-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Pending Approval
            </div>
          </div>
          <div className="text-4xl font-bold text-blue-600">{pendingCount}</div>
          <p className="mt-2 text-sm text-gray-600">PRs waiting for your review</p>
        </div>
        <div className="card border-l-4 border-green-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Approved
            </div>
          </div>
          <div className="text-4xl font-bold text-green-600">{approvedCount}</div>
          <p className="mt-2 text-sm text-gray-600">Total approved PRs</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900">PRs Pending Approval</h3>
          <p className="text-xs text-gray-400">
            Click on any PR to view full details and approve or reject it.
          </p>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400">Loading...</p>
        ) : pendingPrs.length === 0 ? (
          <p className="text-xs text-gray-400">No PRs pending approval at this time.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">PR Number</th>
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Qty</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Payment Method</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingPrs.map((pr) => {
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
                  const paymentMethod = pr.payment_type || pr.payment_method || "-";
                  
                  return (
                    <tr key={pr.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-2 py-2">
                        <span className="font-mono text-xs font-semibold text-gray-900">{pr.pr_number || "-"}</span>
                      </td>
                      <td className="px-2 py-2 text-gray-900 font-medium">{productName}</td>
                      <td className="px-2 py-2 text-gray-700">{skuCode}</td>
                      <td className="px-2 py-2 text-gray-700">{quantity}</td>
                      <td className="px-2 py-2 text-gray-700 font-medium">{amount}</td>
                      <td className="px-2 py-2 text-gray-700 capitalize">{paymentMethod}</td>
                      <td className="px-2 py-2 text-gray-500">
                        {pr.created_at
                          ? new Date(pr.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric"
                            })
                          : "-"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPr(pr)}
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                            title="View PR Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <Link
                            href={`/dashboard/approver/pr/${pr.id}`}
                            className="text-xs font-medium text-green-600 hover:text-green-800"
                          >
                            Review & Approve
                          </Link>
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
