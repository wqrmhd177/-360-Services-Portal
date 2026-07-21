"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentEntriesInput, { PaymentEntryInput } from "@/components/PaymentEntriesInput";

type Props = {
  prId: string;
};

export default function MovementsAddPaymentPanel({ prId }: Props) {
  const router = useRouter();
  const [paymentType, setPaymentType] = useState("advance");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntryInput[]>([
    { transactionId: "", file: null },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const payment_entries: Array<{
        transaction_id: string | null;
        payment_proof_path: string | null;
      }> = [];

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

      const res = await fetch(`/api/growth/pr/${prId}/add-payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_type: paymentType,
          payment_entries,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to submit payment details");
        return;
      }

      setSuccess("Payment details submitted. Finance has been notified.");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-amber-900 mb-1">
        Add Payment Details
      </h3>
      <p className="text-sm text-amber-800 mb-4">
        This Movement PR has been approved. Add payment details below to send it to
        Finance for verification.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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
            <PaymentEntriesInput
              entries={paymentEntries}
              onChange={setPaymentEntries}
              disabled={loading}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-amber-700 text-white rounded-md text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Payment & Send to Finance"}
          </button>
        </form>
      )}
    </div>
  );
}
