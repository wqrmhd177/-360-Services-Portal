"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Qr, PrProduct } from "@/types/workflows";
import MultiProductForm from "@/components/MultiProductForm";
import PaymentEntriesInput, { PaymentEntryInput } from "@/components/PaymentEntriesInput";
import { getCurrencyByCountry } from "@/lib/currency";

interface ConvertQrToPrFormProps {
  qr: Qr;
  userEmail: string;
}

export default function ConvertQrToPrForm({
  qr,
  userEmail,
}: ConvertQrToPrFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize products from QR purchase details (one PR product per procurement combination or per detail for legacy)
  const initializeProducts = (): PrProduct[] => {
    if (!qr.purchase_details || qr.purchase_details.length === 0) {
      return [
        {
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
      ];
    }

    const result: PrProduct[] = [];
    const getQuantityForCountry = (detail: any, destinationCountry: string): number => {
      if (detail.countryDetails && Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0) {
        const cd = detail.countryDetails.find((c: { country: string }) => c.country === destinationCountry);
        return cd ? (cd.quantity ?? 0) : detail.quantity || 0;
      }
      return detail.quantity || 0;
    };

    qr.purchase_details.forEach((detail: any, index: number) => {
      const procResponse =
        qr.procurement_response && typeof qr.procurement_response === "object"
          ? (qr.procurement_response as any)[index]
          : null;

      if (procResponse?.combinations && Array.isArray(procResponse.combinations) && procResponse.combinations.length > 0) {
        procResponse.combinations.forEach((combo: any) => {
          const destinationCountry = combo.destinationCountry || "";
          const quantity = getQuantityForCountry(detail, destinationCountry);
          const currency = getCurrencyByCountry(destinationCountry);
          const landedCost = combo.landedCostPerUnit ?? 0;
          result.push({
            productName: detail.productName || "",
            skuCode: "",
            destinationCountry,
            quantity,
            landedCostPrice: landedCost,
            sellingPricePerUnit: landedCost,
            currency,
            totalAmount: quantity * landedCost,
            shippingType: combo.shippingType || "sea",
            movementType: combo.movementType || "normal",
            remarks: detail.remarks || "",
          });
        });
      } else {
        const destinationCountry = detail.destinationCountries?.[0] || detail.destinationCountry || "";
        const quantity = getQuantityForCountry(detail, destinationCountry);
        const currency = getCurrencyByCountry(destinationCountry);
        const landedCost = procResponse?.landedCostPerUnit || 0;
        result.push({
          productName: detail.productName || "",
          skuCode: "",
          destinationCountry,
          quantity,
          landedCostPrice: landedCost,
          sellingPricePerUnit: landedCost,
          currency,
          totalAmount: quantity * landedCost,
          shippingType: detail.shippingType || "sea",
          movementType: detail.movementType || "normal",
          remarks: detail.remarks || "",
        });
      }
    });
    return result.length > 0 ? result : [{
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
    }];
  };

  const [products, setProducts] = useState<PrProduct[]>(initializeProducts());
  const [sellerChannelName, setSellerChannelName] = useState(
    qr.reseller_code || ""
  );
  const [sellerUserId, setSellerUserId] = useState(qr.reseller_code || "");
  const [sellerServiceType, setSellerServiceType] = useState(
    qr.service_needed || "Zambeel 360"
  );
  const [paymentType, setPaymentType] = useState("advance");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntryInput[]>([
    { transactionId: "", file: null },
  ]);
  const [remarks, setRemarks] = useState(qr.remarks || "");

  const validateForm = (): boolean => {
    // Check seller information
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

    // Check products
    if (products.length === 0) {
      setError("At least one product is required");
      return false;
    }

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
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
      if (p.quantity <= 0) {
        setError(`Product ${i + 1}: Quantity must be greater than 0`);
        return false;
      }
      if (p.sellingPricePerUnit <= 0) {
        setError(`Product ${i + 1}: Selling Price must be greater than 0`);
        return false;
      }
    }

    if (!paymentType) {
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
      // Upload each payment proof and build payment_entries
      const payment_entries: Array<{ transaction_id: string | null; payment_proof_path: string | null }> = [];
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

      // Create PR
      const response = await fetch("/api/growth/pr/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_qr_id: qr.id,
          seller_channel_name: sellerChannelName,
          seller_user_id: sellerUserId,
          seller_service_type: sellerServiceType,
          products: products,
          payment_type: paymentType,
          payment_entries: payment_entries.length > 0 ? payment_entries : undefined,
          remarks: remarks || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.pr_id) {
        // Update QR status to converted_to_pr
        await fetch(`/api/growth/qr/${qr.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "converted_to_pr" }),
        });

        // Redirect to dashboard with success message
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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Create Purchase Request
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Review and complete the PR details based on the quotation
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Seller Information */}
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
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                value={sellerServiceType}
                onChange={(e) => setSellerServiceType(e.target.value)}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="Zambeel 360">Zambeel 360</option>
                <option value="DS2">DS2</option>
                <option value="DS3">DS3</option>
                <option value="DS4">DS4</option>
                <option value="Partner Stores">Partner Stores</option>
                <option value="Amazon">Amazon</option>
                <option value="Sourcing & Logistics">
                  Sourcing & Logistics
                </option>
                <option value="Sourcing only">Sourcing only</option>
                <option value="Logistics Only">Logistics Only</option>
                <option value="3PL & Logistics">3PL & Logistics</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">
            Product Information
          </h3>
          <MultiProductForm
            products={products}
            onChange={setProducts}
            disabled={loading}
            showAddProductButton={false}
          />
        </div>

        {/* Payment Information */}
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

        {/* Remarks */}
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

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating PR...
              </>
            ) : (
              "Create Purchase Request"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
