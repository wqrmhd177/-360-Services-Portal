"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrProduct } from "@/types/workflows";
import MultiProductForm from "@/components/MultiProductForm";
import PaymentEntriesInput, { PaymentEntryInput } from "@/components/PaymentEntriesInput";
import ServiceTypeSelect from "@/components/ServiceTypeSelect";
import { isMovementsService } from "@/lib/serviceTypes";

const emptyMovementsProduct = (): PrProduct => ({
  productName: "",
  skuCode: "",
  fromSku: "",
  toSku: "",
  destinationCountry: "",
  quantity: 0,
  landedCostPrice: 0,
  sellingPricePerUnit: 0,
  currency: "AED",
  totalAmount: 0,
  shippingType: "sea",
  movementType: "normal",
});

export default function NewPRForm({
  initialService = "Zambeel 360",
}: {
  initialService?: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<PrProduct[]>([
    isMovementsService(initialService) ? emptyMovementsProduct() : {
      productName: "",
      skuCode: "",
      destinationCountry: "",
      quantity: 0,
      landedCostPrice: 0,
      sellingPricePerUnit: 0,
      currency: "AED",
      totalAmount: 0,
      shippingType: "sea",
      movementType: "normal",
    },
  ]);

  const [sellerChannelName, setSellerChannelName] = useState("");
  const [sellerUserId, setSellerUserId] = useState("");
  const [sellerServiceType, setSellerServiceType] = useState(initialService);
  const [paymentType, setPaymentType] = useState("advance");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntryInput[]>([
    { transactionId: "", file: null },
  ]);
  const [remarks, setRemarks] = useState("");

  const isMovements = isMovementsService(sellerServiceType);

  useEffect(() => {
    if (isMovements) {
      setProducts((prev) =>
        prev.map((p) => ({
          ...emptyMovementsProduct(),
          ...p,
          fromSku: p.fromSku ?? "",
          toSku: p.toSku ?? "",
        }))
      );
    }
  }, [isMovements]);

  const validateForm = (): boolean => {
    if (!sellerChannelName.trim()) {
      setError("Channel Name is required");
      return false;
    }
    if (!sellerUserId.trim()) {
      setError("User ID is required");
      return false;
    }
    if (!sellerServiceType) {
      setError("Service Type is required");
      return false;
    }

    if (products.length === 0) {
      setError("At least one product is required");
      return false;
    }

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (isMovements) {
        if (!p.fromSku?.trim()) {
          setError(`Product ${i + 1}: From SKU is required`);
          return false;
        }
        if (!p.toSku?.trim()) {
          setError(`Product ${i + 1}: To SKU is required`);
          return false;
        }
      } else {
        if (!p.productName.trim()) {
          setError(`Product ${i + 1}: Product Name is required`);
          return false;
        }
        if (!p.skuCode.trim()) {
          setError(`Product ${i + 1}: SKU Code is required`);
          return false;
        }
        if (!p.destinationCountry) {
          setError(`Product ${i + 1}: Destination Country is required`);
          return false;
        }
      }
      if (p.quantity <= 0) {
        setError(`Product ${i + 1}: Quantity must be greater than 0`);
        return false;
      }
      if (p.sellingPricePerUnit <= 0) {
        setError(`Product ${i + 1}: Selling Price must be greater than 0`);
        return false;
      }
    }

    if (!isMovements && !paymentType) {
      setError("Payment Type is required");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let payment_entries: Array<{
        transaction_id: string | null;
        payment_proof_path: string | null;
      }> | undefined;

      if (!isMovements) {
        payment_entries = [];
        for (const entry of paymentEntries) {
          let path: string | null = null;
          if (entry.file) {
            const formData = new FormData();
            formData.append("file", entry.file);
            const uploadRes = await fetch("/api/upload/payment-proof", {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              path = uploadData.path ?? null;
            }
          }
          payment_entries.push({
            transaction_id: entry.transactionId.trim() || null,
            payment_proof_path: path,
          });
        }
      }

      const productsPayload = isMovements
        ? products.map((p) => ({
            ...p,
            productName:
              p.fromSku && p.toSku ? `${p.fromSku.trim()} → ${p.toSku.trim()}` : p.productName,
            skuCode: p.fromSku?.trim() ?? "",
            destinationCountry: p.destinationCountry || "N/A",
            currency: p.currency || "AED",
            landedCostPrice: 0,
            totalAmount: p.quantity * p.sellingPricePerUnit,
          }))
        : products;

      const response = await fetch("/api/growth/pr/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_qr_id: null,
          seller_channel_name: sellerChannelName,
          seller_user_id: sellerUserId,
          seller_service_type: sellerServiceType,
          products: productsPayload,
          payment_type: isMovements ? undefined : paymentType,
          payment_entries: payment_entries?.length ? payment_entries : undefined,
          remarks: remarks || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.pr_id) {
        router.push(
          `/dashboard/growth?pr_created=${data.pr_number || data.pr_id}`
        );
      } else {
        setError(data.error || "Failed to create PR");
      }
    } catch (err) {
      console.error("Error creating PR:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isMovements ? "Create Movement Request" : "Create New Purchase Request"}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {isMovements
                  ? "Submit a movement request for Approver review. Payment details are added after approval."
                  : "Submit a purchase request for products or services"}
              </p>
            </div>
            <Link
              href="/dashboard/growth"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {isMovements && (
            <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-lg text-sm">
              This request goes directly to the Approver. You will add payment details after
              approval, before Finance verification.
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">
                Seller Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Channel Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sellerChannelName}
                    onChange={(e) => setSellerChannelName(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter channel name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sellerUserId}
                    onChange={(e) => setSellerUserId(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter user ID"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Type <span className="text-red-500">*</span>
                  </label>
                  <ServiceTypeSelect
                    value={sellerServiceType}
                    onChange={setSellerServiceType}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">
                {isMovements ? "Movement Details" : "Product Information"}
              </h3>
              <MultiProductForm
                products={products}
                onChange={setProducts}
                disabled={loading}
                movementsMode={isMovements}
                movementsDirectMode={isMovements}
              />
            </div>

            {!isMovements && (
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">
                  Payment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      required
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="advance">Advance</option>
                      <option value="partial">Partial Payment</option>
                      <option value="invoice">Invoice</option>
                    </select>
                  </div>

                  {(paymentType === "advance" || paymentType === "partial") && (
                    <div className="md:col-span-2">
                      <PaymentEntriesInput
                        entries={paymentEntries}
                        onChange={setPaymentEntries}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Optional remarks"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Link
                href="/dashboard/growth"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Submitting..."
                  : isMovements
                    ? "Submit for Approval"
                    : "Create Purchase Request"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
