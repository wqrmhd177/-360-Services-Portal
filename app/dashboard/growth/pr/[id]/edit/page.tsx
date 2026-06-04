"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { Pr, PrProduct } from "@/types/workflows";
import MultiProductForm from "@/components/MultiProductForm";
import PaymentEntriesInput, { PaymentEntryInput } from "@/components/PaymentEntriesInput";
import { canEditGrowthPr } from "@/lib/growthPrAccess";

export default function EditPRPage() {
  const router = useRouter();
  const params = useParams();
  const prId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prNumber, setPrNumber] = useState<string | null>(null);

  const [products, setProducts] = useState<PrProduct[]>([]);
  const [sellerChannelName, setSellerChannelName] = useState("");
  const [sellerUserId, setSellerUserId] = useState("");
  const [sellerServiceType, setSellerServiceType] = useState("Zambeel 360");
  const [paymentType, setPaymentType] = useState("advance");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntryInput[]>([
    { transactionId: "", file: null },
  ]);
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/growth/pr/${prId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          setError(data?.error || "Failed to load PR");
          return;
        }
        const pr = data as Pr;
        if (!canEditGrowthPr(pr)) {
          setError("This PR cannot be edited in its current state.");
          return;
        }
        setPrNumber(pr.pr_number ?? null);
        setSellerChannelName(pr.seller_channel_name || pr.reseller_code || "");
        setSellerUserId(pr.seller_user_id || pr.reseller_code || "");
        setSellerServiceType(pr.seller_service_type || "Zambeel 360");
        setPaymentType(pr.payment_type || pr.payment_method || "advance");
        setRemarks(pr.remarks || "");

        if (pr.products && pr.products.length > 0) {
          setProducts(pr.products);
        } else if (pr.product_name) {
          setProducts([
            {
              productName: pr.product_name,
              skuCode: pr.sku_code || "",
              destinationCountry: pr.countries?.[0] || "UAE",
              quantity: Number(pr.quantity) || 0,
              landedCostPrice: 0,
              sellingPricePerUnit: Number(pr.rate) || 0,
              currency: "AED",
              totalAmount: Number(pr.amount) || 0,
              shippingType: (pr.shipping_type as PrProduct["shippingType"]) || "sea",
              movementType: (pr.movement_type as PrProduct["movementType"]) || "normal",
            },
          ]);
        }

        if (pr.payment_entries && pr.payment_entries.length > 0) {
          setPaymentEntries(
            pr.payment_entries.map((e) => ({
              transactionId: e.transaction_id || "",
              file: null,
            }))
          );
        } else if (pr.transaction_id) {
          setPaymentEntries([{ transactionId: pr.transaction_id, file: null }]);
        }
      } catch {
        setError("Failed to load PR");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [prId]);

  const validateForm = (): boolean => {
    if (!sellerChannelName.trim()) {
      setError("Channel Name is required");
      return false;
    }
    if (!sellerUserId.trim()) {
      setError("User ID is required");
      return false;
    }
    if (products.length === 0) {
      setError("At least one product is required");
      return false;
    }
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.productName.trim() || !p.skuCode.trim() || !p.destinationCountry || p.quantity <= 0) {
        setError(`Product ${i + 1}: please complete all required fields`);
        return false;
      }
    }
    return true;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payment_entries: Array<{
        transaction_id: string | null;
        payment_proof_path: string | null;
      }> = [];

      const loadRes = await fetch(`/api/growth/pr/${prId}`);
      const existing = (await loadRes.json().catch(() => null)) as Pr | null;
      const existingEntries = existing?.payment_entries ?? [];

      for (let i = 0; i < paymentEntries.length; i++) {
        const entry = paymentEntries[i];
        let path: string | null = existingEntries[i]?.payment_proof_path ?? null;
        if (entry.file) {
          const formData = new FormData();
          formData.append("file", entry.file);
          const uploadRes = await fetch("/api/upload/payment-proof", {
            method: "POST",
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            path = uploadData.path ?? path;
          }
        }
        payment_entries.push({
          transaction_id: entry.transactionId.trim() || null,
          payment_proof_path: path,
        });
      }

      const res = await fetch(`/api/growth/pr/${prId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_channel_name: sellerChannelName,
          seller_user_id: sellerUserId,
          seller_service_type: sellerServiceType,
          products,
          payment_type: paymentType,
          payment_entries: payment_entries.length > 0 ? payment_entries : undefined,
          remarks: remarks || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update PR");
        return;
      }

      router.push("/dashboard/growth/purchase-requests");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">Loading purchase request…</div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/dashboard/growth/purchase-requests" className="text-portal-600 text-sm font-medium">
          ← Back to Purchase Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Purchase Request</h1>
          <p className="mt-1 text-sm text-gray-600">
            {prNumber ? `Updating ${prNumber} — changes will be sent back for approval.` : "Update details and resubmit for approval."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">Seller Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name *</label>
                  <input
                    type="text"
                    value={sellerChannelName}
                    onChange={(e) => setSellerChannelName(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User ID *</label>
                  <input
                    type="text"
                    value={sellerUserId}
                    onChange={(e) => setSellerUserId(e.target.value)}
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                  <select
                    value={sellerServiceType}
                    onChange={(e) => setSellerServiceType(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Zambeel 360">Zambeel 360</option>
                    <option value="DS2">DS2</option>
                    <option value="DS3">DS3</option>
                    <option value="DS4">DS4</option>
                    <option value="Partner Stores">Partner Stores</option>
                    <option value="Amazon">Amazon</option>
                    <option value="Sourcing & Logistics">Sourcing & Logistics</option>
                    <option value="Sourcing only">Sourcing only</option>
                    <option value="Logistics Only">Logistics Only</option>
                    <option value="3PL & Logistics">3PL & Logistics</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">Product Information</h3>
              <MultiProductForm products={products} onChange={setProducts} disabled={saving} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 border-b pb-2">Payment Information</h3>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm mb-4"
              >
                <option value="advance">Advance</option>
                <option value="partial">Partial Payment</option>
                <option value="invoice">Invoice</option>
              </select>
              {(paymentType === "advance" || paymentType === "partial") && (
                <PaymentEntriesInput entries={paymentEntries} onChange={setPaymentEntries} disabled={saving} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Link
                href="/dashboard/growth/purchase-requests"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save & Resubmit"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
