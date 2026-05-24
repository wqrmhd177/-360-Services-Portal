"use client";

import React, { useEffect, useState } from "react";
import { Po } from "@/types/workflows";
import StatusBadge from "./StatusBadge";
import StatusTimeline from "./StatusTimeline";

interface PODetailCardProps {
  po: Po;
  showFullDetails?: boolean;
  className?: string;
}

export default function PODetailCard({
  po,
  showFullDetails = true,
  className = "",
}: PODetailCardProps) {
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Collect all emails to fetch names for
    const emails: string[] = [];
    if (po.created_by_email) emails.push(po.created_by_email);

    if (emails.length === 0) return;

    // Fetch user names
    fetch("/api/users/names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.names) {
          setUserNames(data.names);
        }
      })
      .catch((error) => {
        console.error("Error fetching user names:", error);
      });
  }, [po.created_by_email]);
  const formatDateTime = (dateString?: string | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              PO #{po.po_number || po.id.slice(0, 8)}
            </h2>
            <p className="text-sm text-purple-100 mt-1">
              Created at {formatDateTime(po.created_at)}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={po.status} type="po" />
            <StatusBadge status={po.supplier_payment_status} type="payment" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">PO Type</p>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {po.po_type}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Linked PR Number</p>
              <p className="text-sm font-medium text-gray-900 font-mono">
                {po.pr?.pr_number ? `PR #${po.pr.pr_number}` : po.pr_id ? `PR #${po.pr_id.slice(0, 8)}` : "Independent"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created By</p>
              <p className="text-sm font-medium text-gray-900">
                {po.created_by_email && userNames[po.created_by_email] 
                  ? userNames[po.created_by_email] 
                  : po.created_by_email?.split("@")[0] || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Status</p>
              <StatusBadge status={po.status} type="po" />
            </div>
          </div>
        </div>

        {/* Products / Line items (independent POs or when po.products is present) */}
        {showFullDetails && po.products && Array.isArray(po.products) && po.products.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Products
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left text-gray-700">
                <thead className="border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Product</th>
                    <th className="py-2 pr-4 font-medium">SKU</th>
                    <th className="py-2 pr-4 font-medium">Qty</th>
                    <th className="py-2 pr-4 font-medium">Rate</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {po.products.map((item: { productName?: string; product_name?: string; skuCode?: string; quantity?: number; rate?: number; amount?: number }, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {item.productName ?? item.product_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">{item.skuCode ?? "—"}</td>
                      <td className="py-2 pr-4">{item.quantity ?? "—"}</td>
                      <td className="py-2 pr-4">{item.rate != null ? Number(item.rate) : "—"}</td>
                      <td className="py-2 pr-4">{item.amount != null ? Number(item.amount) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Supplier Information */}
        {showFullDetails && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Supplier Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Supplier Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {po.supplier_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Supplier Location</p>
                <p className="text-sm font-medium text-gray-900">
                  {po.supplier_location}
                </p>
              </div>
              {po.supplier_payment_amount != null && (
                <div>
                  <p className="text-sm text-gray-600">Payment Amount</p>
                  <p className="text-sm font-medium text-gray-900">
                    AED {po.supplier_payment_amount.toFixed(2)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={po.supplier_payment_status} type="payment" />
                  {po.supplier_payment_status === "paid" && po.supplier_payment_proof && (
                    <a
                      href={po.supplier_payment_proof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download payment proof
                    </a>
                  )}
                </div>
              </div>
              {po.supplier_payment_remarks && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Payment Remarks</p>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded">
                    {po.supplier_payment_remarks}
                  </p>
                </div>
              )}
              {po.supplier_invoice_file && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 mb-2">Invoice</p>
                  <a
                    href={po.supplier_invoice_file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    View Invoice
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Partner Information */}
        {showFullDetails && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Delivery Partner Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Delivery Partner</p>
                <p className="text-sm font-medium text-gray-900">
                  {po.delivery_partner}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tracking ID</p>
                <p className="text-sm font-medium text-gray-900">
                  {po.delivery_partner_tracking_id || "—"}
                </p>
              </div>
              {po.delivery_partner_payment_amount != null && (
                <div>
                  <p className="text-sm text-gray-600">Payment Amount</p>
                  <p className="text-sm font-medium text-gray-900">
                    AED {po.delivery_partner_payment_amount.toFixed(2)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={po.delivery_partner_payment_status}
                    type="payment"
                  />
                  {po.delivery_partner_payment_status === "paid" && po.delivery_partner_payment_proof && (
                    <a
                      href={po.delivery_partner_payment_proof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download payment proof
                    </a>
                  )}
                </div>
              </div>
              {po.delivery_partner_remarks && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Remarks</p>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded">
                    {po.delivery_partner_remarks}
                  </p>
                </div>
              )}
              {po.delivery_partner_invoice_file && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 mb-2">Invoice</p>
                  <a
                    href={po.delivery_partner_invoice_file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    View Invoice
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remarks */}
        {showFullDetails && po.remarks && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Remarks
            </h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
              {po.remarks}
            </p>
          </div>
        )}

        {/* Status History */}
        {showFullDetails && po.status_history && po.status_history.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Status History
            </h3>
            <StatusTimeline statusHistory={po.status_history} />
          </div>
        )}
      </div>
    </div>
  );
}
