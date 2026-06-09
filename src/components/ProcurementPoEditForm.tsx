"use client";

import { useState } from "react";
import type { Po, PoProduct } from "@/types/workflows";
import { recalcProductLine } from "@/components/PoProductsTable";

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface ProcurementPoEditFormProps {
  po: Po;
}

export default function ProcurementPoEditForm({ po }: ProcurementPoEditFormProps) {
  const [supplierName, setSupplierName] = useState(po.supplier_name ?? "");
  const [supplierLocation, setSupplierLocation] = useState(po.supplier_location ?? "");
  const [deliveryPartner, setDeliveryPartner] = useState(po.delivery_partner ?? "");
  const [trackingId, setTrackingId] = useState(po.delivery_partner_tracking_id ?? "");
  const [remarks, setRemarks] = useState(po.remarks ?? "");
  const [poType, setPoType] = useState(po.po_type ?? "internal");
  const [products, setProducts] = useState<PoProduct[]>(
    Array.isArray(po.products) ? po.products : []
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateProduct(index: number, field: keyof PoProduct, raw: string) {
    setProducts((prev) => {
      const next = [...prev];
      const numericFields = new Set([
        "quantity",
        "rate",
        "amount",
        "productCostPerUnit",
        "freightCostPerUnit",
      ]);
      const value = numericFields.has(field) ? Number(raw) || 0 : raw;
      next[index] = recalcProductLine(next[index], field, value);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/procurement/po/${po.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_name: supplierName,
          supplier_location: supplierLocation,
          delivery_partner: deliveryPartner,
          delivery_partner_tracking_id: trackingId,
          remarks: remarks || null,
          po_type: poType,
          products,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save changes.");
        return;
      }
      setMessage("PO updated successfully.");
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Edit PO Details</h3>
        <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-50">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {message && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Supplier Name</label>
          <input className={inputClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Supplier Location</label>
          <input className={inputClass} value={supplierLocation} onChange={(e) => setSupplierLocation(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Delivery Partner</label>
          <input className={inputClass} value={deliveryPartner} onChange={(e) => setDeliveryPartner(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tracking ID</label>
          <input className={inputClass} value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">PO Type</label>
          <select className={inputClass} value={poType} onChange={(e) => setPoType(e.target.value as Po["po_type"])}>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Remarks</label>
          <textarea className={inputClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>

      {products.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-2 pr-2 font-medium">Product</th>
                <th className="py-2 pr-2 font-medium">SKU</th>
                <th className="py-2 pr-2 font-medium">Qty</th>
                <th className="py-2 pr-2 font-medium">Product Cost</th>
                <th className="py-2 pr-2 font-medium">Freight Cost</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-2">
                    <input className={inputClass} value={p.productName} onChange={(e) => updateProduct(i, "productName", e.target.value)} />
                  </td>
                  <td className="py-2 pr-2">
                    <input className={inputClass} value={p.skuCode ?? ""} onChange={(e) => updateProduct(i, "skuCode", e.target.value)} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" min={1} className={inputClass} value={p.quantity} onChange={(e) => updateProduct(i, "quantity", e.target.value)} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" min={0} step="0.01" className={inputClass} value={p.productCostPerUnit ?? ""} onChange={(e) => updateProduct(i, "productCostPerUnit", e.target.value)} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" min={0} step="0.01" className={inputClass} value={p.freightCostPerUnit ?? ""} onChange={(e) => updateProduct(i, "freightCostPerUnit", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}
