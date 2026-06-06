"use client";

import { useState, useRef } from "react";
import type { PoProduct } from "@/types/workflows";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const labelClass = "block text-sm font-medium text-gray-700";

const emptyProductLine: PoProduct = {
  productName: "",
  skuCode: "",
  quantity: 0,
  rate: 0,
  amount: 0,
};

export default function CreatePOForm({
  createPo,
}: {
  createPo: (formData: FormData) => Promise<void>;
}) {
  const [creationMode, setCreationMode] = useState<"linked" | "independent">("linked");
  const [productLines, setProductLines] = useState<PoProduct[]>([{ ...emptyProductLine }]);
  const [supplierInvoiceFile, setSupplierInvoiceFile] = useState<File | null>(null);
  const [deliveryInvoiceFile, setDeliveryInvoiceFile] = useState<File | null>(null);
  const supplierInvoiceRef = useRef<HTMLInputElement>(null);
  const deliveryInvoiceRef = useRef<HTMLInputElement>(null);

  function addProductLine() {
    setProductLines((prev) => [...prev, { ...emptyProductLine }]);
  }

  function removeProductLine(index: number) {
    setProductLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateProductLine(index: number, field: keyof PoProduct, value: string | number) {
    setProductLines((prev) => {
      const next = [...prev];
      (next[index] as any)[field] = value;
      if (field === "quantity" || field === "rate") {
        const q = field === "quantity" ? Number(value) : next[index].quantity;
        const r = field === "rate" ? Number(value) : next[index].rate ?? 0;
        next[index].amount = q * r;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("creation_mode", creationMode);
    if (creationMode === "independent") {
      const validLines = productLines.filter(
        (p) => p.productName.trim() !== "" && Number(p.quantity) > 0
      );
      if (validLines.length === 0) {
        alert("Add at least one product line with name and quantity.");
        return;
      }
      formData.set(
        "products",
        JSON.stringify(
          validLines.map((p) => ({
            productName: p.productName.trim(),
            skuCode: p.skuCode?.trim() || undefined,
            quantity: Number(p.quantity),
            rate: Number(p.rate) || undefined,
            amount: Number(p.amount) || undefined,
          }))
        )
      );
    }
    await createPo(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      {/* Creation mode */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
          Creation mode
        </h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="creation_mode"
              value="linked"
              checked={creationMode === "linked"}
              onChange={() => setCreationMode("linked")}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={labelClass}>Link to PR</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="creation_mode"
              value="independent"
              checked={creationMode === "independent"}
              onChange={() => setCreationMode("independent")}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={labelClass}>Create independently</span>
          </label>
        </div>
      </div>

      {/* Linked PR ID - only when linked */}
      {creationMode === "linked" && (
        <div className="space-y-2">
          <label htmlFor="pr_id" className={labelClass}>
            Linked PR ID <span className="text-red-500">*</span>
          </label>
          <input
            id="pr_id"
            name="pr_id"
            type="text"
            placeholder="Paste PR ID (UUID from PR table)"
            required={creationMode === "linked"}
            className={inputClass}
          />
        </div>
      )}

      {/* Product lines - only when independent */}
      {creationMode === "independent" && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Products (at least one line)
          </h3>
          <div className="space-y-3">
            {productLines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 rounded-lg border border-gray-200 bg-gray-50/50"
              >
                <div className="md:col-span-3">
                  <label className={labelClass}>Product name</label>
                  <input
                    type="text"
                    value={line.productName}
                    onChange={(e) => updateProductLine(index, "productName", e.target.value)}
                    className={inputClass}
                    placeholder="Name"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>SKU (optional)</label>
                  <input
                    type="text"
                    value={line.skuCode ?? ""}
                    onChange={(e) => updateProductLine(index, "skuCode", e.target.value)}
                    className={inputClass}
                    placeholder="SKU"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className={labelClass}>Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity || ""}
                    onChange={(e) =>
                      updateProductLine(index, "quantity", e.target.value ? Number(e.target.value) : 0)
                    }
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Rate</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.rate ?? ""}
                    onChange={(e) =>
                      updateProductLine(index, "rate", e.target.value ? Number(e.target.value) : 0)
                    }
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.amount ?? ""}
                    readOnly
                    className={inputClass + " bg-gray-100"}
                  />
                </div>
                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeProductLine(index)}
                    disabled={productLines.length === 1}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addProductLine}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Add line
            </button>
          </div>
        </div>
      )}

      {/* Shared: PO Type, Supplier, Delivery */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
          PO type & supplier
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="po_type" className={labelClass}>
              PO Type
            </label>
            <select
              id="po_type"
              name="po_type"
              defaultValue="internal"
              className={inputClass}
            >
              <option value="internal">Internal</option>
              <option value="external">External</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2 md:grid md:grid-cols-2 md:gap-4">
            <div className="space-y-2">
              <label htmlFor="supplier_name" className={labelClass}>
                Supplier name <span className="text-red-500">*</span>
              </label>
              <input
                id="supplier_name"
                name="supplier_name"
                type="text"
                required
                className={inputClass}
                placeholder="Supplier name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="supplier_location" className={labelClass}>
                Supplier location <span className="text-red-500">*</span>
              </label>
              <input
                id="supplier_location"
                name="supplier_location"
                type="text"
                required
                className={inputClass}
                placeholder="City, country"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
          Delivery partner
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="delivery_partner" className={labelClass}>
              Delivery partner <span className="text-red-500">*</span>
            </label>
            <input
              id="delivery_partner"
              name="delivery_partner"
              type="text"
              required
              className={inputClass}
              placeholder="Delivery partner name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="delivery_partner_tracking_id" className={labelClass}>
              Tracking ID
            </label>
            <input
              id="delivery_partner_tracking_id"
              name="delivery_partner_tracking_id"
              type="text"
              className={inputClass}
              placeholder="Optional — can be added after order placement"
            />
          </div>
        </div>
      </div>

      {/* Invoice file uploads */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3">
          Invoice Documents (optional)
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass}>Supplier Invoice</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50">
              <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="truncate">
                {supplierInvoiceFile ? supplierInvoiceFile.name : "Attach image / PDF / CSV / Excel"}
              </span>
              <input
                ref={supplierInvoiceRef}
                type="file"
                name="supplier_invoice_file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setSupplierInvoiceFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {supplierInvoiceFile && (
              <button
                type="button"
                onClick={() => { setSupplierInvoiceFile(null); if (supplierInvoiceRef.current) supplierInvoiceRef.current.value = ""; }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Delivery Invoice</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50">
              <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="truncate">
                {deliveryInvoiceFile ? deliveryInvoiceFile.name : "Attach image / PDF / CSV / Excel"}
              </span>
              <input
                ref={deliveryInvoiceRef}
                type="file"
                name="delivery_partner_invoice_file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setDeliveryInvoiceFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {deliveryInvoiceFile && (
              <button
                type="button"
                onClick={() => { setDeliveryInvoiceFile(null); if (deliveryInvoiceRef.current) deliveryInvoiceRef.current.value = ""; }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="remarks" className={labelClass}>
          Remarks
        </label>
        <textarea
          id="remarks"
          name="remarks"
          rows={3}
          className={inputClass}
          placeholder="Optional remarks"
        />
      </div>

      <button type="submit" className="btn-primary">
        Save PO
      </button>
    </form>
  );
}
