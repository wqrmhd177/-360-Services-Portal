"use client";

import type { Pr } from "@/types/workflows";

interface PurchaseRequestSummaryProps {
  pr: Pr;
  userNames: Map<string, string>;
}

export default function PurchaseRequestSummary({ pr, userNames }: PurchaseRequestSummaryProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const createdByName = pr.created_by_email
    ? (userNames.get(pr.created_by_email) ?? pr.created_by_email.split("@")[0])
    : "N/A";

  // Parse products if it's a JSON string
  let productsArray: any[] = [];
  try {
    if (typeof pr.products === "string") {
      productsArray = JSON.parse(pr.products);
    } else if (Array.isArray(pr.products)) {
      productsArray = pr.products;
    }
  } catch (e) {
    console.error("Failed to parse products:", e);
  }

  // Calculate total amount and currency (assume all products share the same currency; fallback to AED)
  const totalAmount = productsArray.length > 0
    ? productsArray.reduce((sum, p) => sum + (Number(p.totalAmount ?? p.amount) || 0), 0)
    : pr.amount;
  const totalCurrency =
    (productsArray.length > 0 && (productsArray[0].currency as string | undefined)) ||
    (Array.isArray(pr.products) && pr.products[0]?.currency) ||
    "AED";

  return (
    <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {/* Header Card with PR Number and Status */}
      <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">
              PR #{pr.pr_number || pr.id.slice(0, 8)}
            </h3>
            <p className="text-sm text-blue-100">
              Created by {createdByName}
            </p>
            <p className="text-sm text-blue-100">
              Created at {formatDateTime(pr.created_at)}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                pr.approval_status === "approved"
                  ? "bg-green-500 text-white"
                  : "bg-yellow-500 text-white"
              }`}
            >
              {pr.approval_status === "approved" ? "Approved" : pr.approval_status}
            </span>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                pr.finance_verification_status === "verified"
                  ? "bg-green-500 text-white"
                  : "bg-yellow-500 text-white"
              }`}
            >
              {pr.finance_verification_status === "verified" ? "Payment Verified" : "Payment Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Seller Information */}
      {(pr.seller_channel_name || pr.seller_user_id || pr.seller_service_type) && (
        <div className="card">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            Seller Information
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {pr.seller_channel_name && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Channel Name
                </label>
                <p className="text-sm text-gray-900">{pr.seller_channel_name}</p>
              </div>
            )}
            {pr.seller_user_id && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  User ID
                </label>
                <p className="text-sm text-gray-900">{pr.seller_user_id}</p>
              </div>
            )}
            {pr.seller_service_type && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Service Type
                </label>
                <p className="text-sm text-gray-900">{pr.seller_service_type}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Information */}
      <div className="card">
        <h4 className="text-base font-semibold text-gray-900 mb-4">
          Product Information
        </h4>

        {productsArray.length > 0 ? (
          <div className="space-y-4">
            {productsArray.map((product: any, idx: number) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <h5 className="text-base font-semibold text-gray-900">
                    {product.product_name || product.name || "Unnamed Product"}
                  </h5>
                  <span className="text-lg font-bold text-blue-600">
                    AED {typeof product.amount === "number" ? product.amount.toFixed(2) : product.amount}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {product.sku_code && (
                    <div>
                      <span className="text-gray-500">SKU Code</span>
                      <p className="font-medium text-gray-900">{product.sku_code}</p>
                    </div>
                  )}
                  {product.destination && (
                    <div>
                      <span className="text-gray-500">Destination</span>
                      <p className="font-medium text-gray-900">{product.destination}</p>
                    </div>
                  )}
                  {product.quantity && (
                    <div>
                      <span className="text-gray-500">Quantity</span>
                      <p className="font-medium text-gray-900">{product.quantity} units</p>
                    </div>
                  )}
                  {product.rate && (
                    <div>
                      <span className="text-gray-500">Price/Unit</span>
                      <p className="font-medium text-gray-900">AED {product.rate}</p>
                    </div>
                  )}
                  {product.shipping_type && (
                    <div>
                      <span className="text-gray-500">Shipping</span>
                      <p className="font-medium text-gray-900 capitalize">{product.shipping_type}</p>
                    </div>
                  )}
                  {product.movement_type && (
                    <div>
                      <span className="text-gray-500">Movement</span>
                      <p className="font-medium text-gray-900 capitalize">{product.movement_type}</p>
                    </div>
                  )}
                  {product.remarks && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Remarks</span>
                      <p className="font-medium text-gray-900">{product.remarks}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Total Amount */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-gray-900">
                  Total Amount ({productsArray.length} product{productsArray.length > 1 ? "s" : ""})
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  {totalCurrency}{" "}
                  {typeof totalAmount === "number" ? totalAmount.toFixed(2) : totalAmount}
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Fallback to single product fields
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              {pr.product_name && (
                <h5 className="text-base font-semibold text-gray-900 mb-3">
                  {pr.product_name}
                </h5>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {pr.sku_code && (
                  <div>
                    <span className="text-gray-500">SKU Code</span>
                    <p className="font-medium text-gray-900">{pr.sku_code}</p>
                  </div>
                )}
                {pr.quantity && (
                  <div>
                    <span className="text-gray-500">Quantity</span>
                    <p className="font-medium text-gray-900">{pr.quantity}</p>
                  </div>
                )}
                {pr.amount && (
                  <div>
                    <span className="text-gray-500">Amount</span>
                    <p className="font-medium text-gray-900">
                      AED {typeof pr.amount === "number" ? pr.amount.toFixed(2) : pr.amount}
                    </p>
                  </div>
                )}
                {pr.shipping_type && (
                  <div>
                    <span className="text-gray-500">Shipping</span>
                    <p className="font-medium text-gray-900 capitalize">{pr.shipping_type}</p>
                  </div>
                )}
                {pr.movement_type && (
                  <div>
                    <span className="text-gray-500">Movement</span>
                    <p className="font-medium text-gray-900 capitalize">{pr.movement_type}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Information */}
      <div className="card">
        <h4 className="text-base font-semibold text-gray-900 mb-4">
          Payment Information
        </h4>
        <div className="space-y-3">
          {pr.payment_type && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Payment Type
              </label>
              <p className="text-sm text-gray-900 capitalize">{pr.payment_type}</p>
            </div>
          )}
          {pr.payment_entries && Array.isArray(pr.payment_entries) && pr.payment_entries.length > 0 ? (
            pr.payment_entries.map((entry: { transaction_id?: string | null; payment_proof_path?: string | null }, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                {pr.payment_entries!.length > 1 && (
                  <p className="text-xs font-medium text-gray-500">Entry #{idx + 1}</p>
                )}
                {entry.transaction_id && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Transaction ID</label>
                    <p className="text-sm font-mono text-gray-900">{entry.transaction_id}</p>
                  </div>
                )}
                {entry.payment_proof_path && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Payment Proof</label>
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <img
                        src={entry.payment_proof_path}
                        alt="Payment Proof"
                        className="w-full h-auto"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling!.classList.remove("hidden");
                        }}
                      />
                      <div className="hidden p-4 bg-gray-50 text-center">
                        <p className="text-xs text-gray-500">Payment proof image unavailable</p>
                        <p className="text-xs text-gray-400 mt-1 break-all">{entry.payment_proof_path}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <>
              {pr.transaction_id && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Transaction ID</label>
                  <p className="text-sm font-mono text-gray-900">{pr.transaction_id}</p>
                </div>
              )}
              {pr.payment_proof_path && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Payment Proof</label>
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <img
                      src={pr.payment_proof_path}
                      alt="Payment Proof"
                      className="w-full h-auto"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling!.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden p-4 bg-gray-50 text-center">
                      <p className="text-xs text-gray-500">Payment proof image unavailable</p>
                      <p className="text-xs text-gray-400 mt-1 break-all">{pr.payment_proof_path}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Approval Information */}
      <div className="card">
        <h4 className="text-base font-semibold text-gray-900 mb-4">
          Approval Information
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Approved By
            </label>
            <p className="text-sm text-gray-900">
              {pr.approved_by_email ? userNames.get(pr.approved_by_email) || "N/A" : "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Approved On
            </label>
            <p className="text-sm text-gray-900">
              {formatDate(pr.approved_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Finance Verification */}
      <div className="card">
        <h4 className="text-base font-semibold text-gray-900 mb-4">
          Finance Verification
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Verified By
            </label>
            <p className="text-sm text-gray-900">
              {pr.finance_verified_by_email ? userNames.get(pr.finance_verified_by_email) || "N/A" : "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Verified On
            </label>
            <p className="text-sm text-gray-900">
              {formatDate(pr.finance_verified_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Remarks */}
      {pr.remarks && (
        <div className="card">
          <h4 className="text-base font-semibold text-gray-900 mb-3">
            Remarks
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
            {pr.remarks}
          </p>
        </div>
      )}
    </div>
  );
}
