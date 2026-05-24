"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Pr } from "@/types/workflows";

interface ConvertPrToPoFormProps {
  pr: Pr;
  userEmail: string;
}

export default function ConvertPrToPoForm({ pr, userEmail }: ConvertPrToPoFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      // Call the server action via API route
      const response = await fetch(`/api/procurement/pr/${pr.id}/convert`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to create PO");
      }

      const result = await response.json();
      
      // Redirect with success message
      if (result.po_number) {
        router.push(`/dashboard/procurement?po_created=${result.po_number}`);
      } else {
        router.push("/dashboard/procurement");
      }
    } catch (error) {
      console.error("Error creating PO:", error);
      alert("Failed to create Purchase Order. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Create Purchase Order
        </h3>
        <p className="text-sm text-gray-500">
          Fill in the supplier and delivery details to create a PO from this approved PR.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            PO Type <span className="text-red-500">*</span>
          </label>
          <select
            name="po_type"
            defaultValue="internal"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>

        {/* Supplier Details Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
            Supplier Information
          </h4>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="supplier_name"
              required
              placeholder="Enter supplier name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Supplier Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="supplier_location"
              required
              placeholder="City, Country"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Supplier Payment Amount (Optional)
            </label>
            <input
              type="number"
              name="supplier_payment_amount"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">Leave empty if not applicable</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Supplier Invoice File Path
            </label>
            <input
              type="text"
              name="supplier_invoice_file"
              placeholder="supplier-invoice-001.pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400">
              In production, this would be an image/file upload to Supabase Storage
            </p>
          </div>
        </div>

        {/* Delivery Partner Details Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
            Delivery Partner Information
          </h4>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Delivery Partner <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="delivery_partner"
              required
              placeholder="Enter delivery partner name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tracking ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="delivery_partner_tracking_id"
              required
              placeholder="Enter tracking ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Delivery Payment Amount (Optional)
            </label>
            <input
              type="number"
              name="delivery_partner_payment_amount"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">Leave empty if not applicable</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Delivery Invoice File Path
            </label>
            <input
              type="text"
              name="delivery_partner_invoice_file"
              placeholder="delivery-invoice-001.pdf"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400">
              In production, this would be an image/file upload to Supabase Storage
            </p>
          </div>
        </div>

        {/* Remarks */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Remarks / Additional Notes
          </label>
          <textarea
            name="remarks"
            rows={4}
            placeholder="Add any additional notes or special instructions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating Purchase Order...
              </span>
            ) : (
              "Create Purchase Order"
            )}
          </button>
          <p className="mt-3 text-xs text-gray-500 text-center">
            This will create a new PO with status &quot;Order Placed&quot; and mark the PR as PO-created.
          </p>
        </div>
      </form>
    </div>
  );
}
