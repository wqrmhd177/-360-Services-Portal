"use client";

import { useState } from "react";
import type { Po } from "@/types/workflows";
import { useFormStatus } from "react-dom";

interface PoPaymentAndInvoiceEditFormProps {
  po: Po;
  action: (formData: FormData) => void | Promise<void>;
}

const ACCEPT_INVOICE_FILES =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${
        pending
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-blue-600 hover:bg-blue-700"
      }`}
      disabled={pending}
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export function PoPaymentAndInvoiceEditForm({
  po,
  action
}: PoPaymentAndInvoiceEditFormProps) {
  const [supplierInvoiceName, setSupplierInvoiceName] = useState<string | null>(
    null
  );
  const [deliveryInvoiceName, setDeliveryInvoiceName] = useState<string | null>(
    null
  );

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="poId" value={po.id} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Payment &amp; Invoice Details
        </h3>
        <SubmitButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Supplier
          </h4>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Supplier Payment Amount (Optional)
            </label>
            <input
              type="number"
              name="supplier_payment_amount"
              min={0}
              step="0.01"
              defaultValue={
                po.supplier_payment_amount != null
                  ? String(po.supplier_payment_amount)
                  : ""
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter amount"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Supplier Invoice File (Image or PDF)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-200">
                Choose file
                <input
                  type="file"
                  name="supplier_invoice_file"
                  accept={ACCEPT_INVOICE_FILES}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setSupplierInvoiceName(file ? file.name : null);
                  }}
                />
              </label>
              {supplierInvoiceName && (
                <span className="text-[11px] text-gray-600 truncate max-w-[140px]">
                  {supplierInvoiceName}
                </span>
              )}
              {!supplierInvoiceName && po.supplier_invoice_file && (
                <a
                  href={po.supplier_invoice_file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  View current invoice
                </a>
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              Optional. Upload a new invoice to replace the existing file.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Delivery Partner
          </h4>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Tracking ID (Optional)
            </label>
            <input
              type="text"
              name="delivery_partner_tracking_id"
              defaultValue={po.delivery_partner_tracking_id ?? ""}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter tracking ID"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Delivery Payment Amount (Optional)
            </label>
            <input
              type="number"
              name="delivery_partner_payment_amount"
              min={0}
              step="0.01"
              defaultValue={
                po.delivery_partner_payment_amount != null
                  ? String(po.delivery_partner_payment_amount)
                  : ""
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter amount"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">
              Delivery Invoice File (Image or PDF)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-200">
                Choose file
                <input
                  type="file"
                  name="delivery_partner_invoice_file"
                  accept={ACCEPT_INVOICE_FILES}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setDeliveryInvoiceName(file ? file.name : null);
                  }}
                />
              </label>
              {deliveryInvoiceName && (
                <span className="text-[11px] text-gray-600 truncate max-w-[140px]">
                  {deliveryInvoiceName}
                </span>
              )}
              {!deliveryInvoiceName && po.delivery_partner_invoice_file && (
                <a
                  href={po.delivery_partner_invoice_file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  View current invoice
                </a>
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              Optional. Upload a new invoice to replace the existing file.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

