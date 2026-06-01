"use client";

import React, { useEffect, useState } from "react";
import { Pr } from "@/types/workflows";
import StatusBadge from "./StatusBadge";
import ImageGallery from "./ImageGallery";
import { formatCurrency } from "@/lib/currency";

interface PRDetailCardProps {
  pr: Pr;
  showFullDetails?: boolean;
  className?: string;
}

export default function PRDetailCard({
  pr,
  showFullDetails = true,
  className = "",
}: PRDetailCardProps) {
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Collect all emails to fetch names for
    const emails: string[] = [];
    if (pr.created_by_email) emails.push(pr.created_by_email);
    if (pr.approved_by_email) emails.push(pr.approved_by_email);
    if (pr.finance_verified_by_email) emails.push(pr.finance_verified_by_email);

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
  }, [pr.created_by_email, pr.approved_by_email, pr.finance_verified_by_email]);
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

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

  const createdByName =
    pr.created_by_email && userNames[pr.created_by_email]
      ? userNames[pr.created_by_email]
      : pr.created_by_email?.split("@")[0] || "N/A";

  const getTotalAmount = (): number => {
    if (pr.products && pr.products.length > 0) {
      return pr.products.reduce((sum, p) => sum + p.totalAmount, 0);
    }
    return pr.amount || 0;
  };

  const getTotalLandedCost = (): number => {
    if (pr.products && pr.products.length > 0) {
      return pr.products.reduce(
        (sum, p) => sum + (p.landedCostPrice ?? 0) * p.quantity,
        0
      );
    }
    return 0;
  };

  const getTotalMargin = (): number => getTotalAmount() - getTotalLandedCost();

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              PR #{pr.pr_number || pr.id.slice(0, 8)}
            </h2>
            <p className="text-sm text-blue-100 mt-1">
              Created by {createdByName}
            </p>
            <p className="text-sm text-blue-100">
              Created at {formatDateTime(pr.created_at)}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {/* If we have an overall PR status, show that + finance. Otherwise show approval + finance. */}
            {pr.pr_status ? (
              <>
                <StatusBadge status={pr.pr_status} type="pr" />
                <StatusBadge
                  status={pr.finance_verification_status}
                  type="finance"
                />
              </>
            ) : (
              <>
                <StatusBadge status={pr.approval_status} type="approval" />
                <StatusBadge
                  status={pr.finance_verification_status}
                  type="finance"
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Seller Information */}
        {showFullDetails && (pr.seller_channel_name || pr.reseller_code) && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Seller Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Channel Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.seller_channel_name || pr.reseller_code || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.seller_user_id || pr.reseller_code || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Service Type</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.seller_service_type || "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Product Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
            Product Information
          </h3>
          
          {/* Multi-product display */}
          {pr.products && pr.products.length > 0 ? (
            <div className="space-y-4">
              {pr.products.map((product, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">
                      {product.productName}
                    </h4>
                    <span className="text-sm font-medium text-blue-600">
                      {formatCurrency(product.totalAmount, product.currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">SKU Code</p>
                      <p className="font-medium text-gray-900">
                        {product.skuCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Destination</p>
                      <p className="font-medium text-gray-900">
                        {product.destinationCountry}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Quantity</p>
                      <p className="font-medium text-gray-900">
                        {product.quantity} units
                      </p>
                    </div>
                    {(product.landedCostPrice ?? 0) > 0 && (
                      <div>
                        <p className="text-gray-600">Landed Cost/Unit</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(product.landedCostPrice ?? 0, product.currency)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-600">Selling Price/Unit</p>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(
                          product.sellingPricePerUnit,
                          product.currency
                        )}
                      </p>
                    </div>
                    {(product.landedCostPrice ?? 0) > 0 && (
                      <div>
                        <p className="text-gray-600">Margin</p>
                        <p className={`font-medium ${(product.sellingPricePerUnit - (product.landedCostPrice ?? 0)) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(
                            (product.sellingPricePerUnit - (product.landedCostPrice ?? 0)) * product.quantity,
                            product.currency
                          )}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-600">Shipping</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {product.shippingType}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Movement</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {product.movementType}
                      </p>
                    </div>
                    {product.remarks && (
                      <div className="md:col-span-2">
                        <p className="text-gray-600">Remarks</p>
                        <p className="font-medium text-gray-900">
                          {product.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-2">
                {getTotalLandedCost() > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Landed Cost</span>
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(getTotalLandedCost(), pr.products[0]?.currency || "AED")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Total Selling ({pr.products.length} products)
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(
                      getTotalAmount(),
                      pr.products[0]?.currency || "AED"
                    )}
                  </span>
                </div>
                {getTotalLandedCost() > 0 && (
                  <div className="flex items-center justify-between text-sm border-t border-blue-200 pt-2">
                    <span className="text-gray-600 font-medium">Total Margin</span>
                    <span className={`font-bold ${getTotalMargin() >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(getTotalMargin(), pr.products[0]?.currency || "AED")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Legacy single product display */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Product Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.product_name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">SKU Code</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.sku_code || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Quantity</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.quantity || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-sm font-medium text-gray-900">
                  AED {pr.amount?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Payment Information */}
        {showFullDetails && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Payment Information
            </h3>
            <div className="space-y-4">
              {/* Payment Type */}
              <div>
                <p className="text-sm text-gray-600">Payment Type</p>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {pr.payment_type || pr.payment_method || "N/A"}
                </p>
              </div>

              {/* Each entry: Transaction ID + Proof together */}
              {pr.payment_entries && Array.isArray(pr.payment_entries) && pr.payment_entries.length > 0 ? (
                pr.payment_entries.map((entry: { transaction_id?: string | null; payment_proof_path?: string | null }, idx: number) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {pr.payment_entries!.length > 1 && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Entry #{idx + 1}
                      </p>
                    )}
                    <div className="flex items-start gap-4">
                      {/* Proof thumbnail */}
                      {entry.payment_proof_path ? (
                        <div className="shrink-0">
                          <ImageGallery
                            images={[entry.payment_proof_path]}
                            alt={`Payment proof ${idx + 1}`}
                            thumbnailSize="lg"
                          />
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-xs text-gray-400">
                          No image
                        </div>
                      )}
                      {/* Transaction ID alongside */}
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-xs text-gray-500">Transaction ID</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900 break-all">
                          {entry.transaction_id || <span className="text-gray-400 font-normal">Not provided</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* Legacy single-entry fallback */
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start gap-4">
                    {pr.payment_proof_path ? (
                      <div className="shrink-0">
                        <ImageGallery
                          images={[pr.payment_proof_path]}
                          alt="Payment proof"
                          thumbnailSize="lg"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-xs text-gray-400">
                        No image
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-xs text-gray-500">Transaction ID</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 break-all">
                        {pr.transaction_id || <span className="text-gray-400 font-normal">Not provided</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approval Information */}
        {showFullDetails && pr.approved_by_email && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Approval Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Approved By</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.approved_by_email && userNames[pr.approved_by_email] 
                    ? userNames[pr.approved_by_email] 
                    : pr.approved_by_email?.split("@")[0] || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Approved On</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(pr.approved_at)}
                </p>
              </div>
              {pr.approval_remarks && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Remarks</p>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded">
                    {pr.approval_remarks}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Finance Information */}
        {showFullDetails && pr.finance_verified_by_email && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Finance Verification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Verified By</p>
                <p className="text-sm font-medium text-gray-900">
                  {pr.finance_verified_by_email && userNames[pr.finance_verified_by_email] 
                    ? userNames[pr.finance_verified_by_email] 
                    : pr.finance_verified_by_email?.split("@")[0] || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Verified On</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(pr.finance_verified_at)}
                </p>
              </div>
              {pr.finance_remarks && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Remarks</p>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded">
                    {pr.finance_remarks}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rejection Information */}
        {showFullDetails &&
          pr.approval_status === "rejected" &&
          pr.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Rejection Reason
              </h3>
              <p className="text-sm text-red-800">{pr.rejection_reason}</p>
              <p className="text-xs text-red-600 mt-2">
                Rejected on {formatDate(pr.rejected_at)}
              </p>
            </div>
          )}

        {/* Remarks */}
        {showFullDetails && pr.remarks && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Remarks
            </h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
              {pr.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
