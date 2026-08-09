"use client";

import { useState } from "react";
import type { MovementRequest } from "@/types/movements";
import { MOVEMENT_COUNTRY_OPTIONS } from "@/types/movements";
import { canCreatorEdit, canCreatorCancel } from "@/lib/movements/status";

export function MovementCreatorResubmitForm({
  movement,
  onUpdated,
}: {
  movement: MovementRequest;
  onUpdated: () => void;
}) {
  const [fromSku, setFromSku] = useState(movement.from_sku);
  const [fromCountry, setFromCountry] = useState(movement.from_country);
  const [toSku, setToSku] = useState(movement.to_sku);
  const [toCountry, setToCountry] = useState(movement.to_country);
  const [quantity, setQuantity] = useState(String(movement.quantity));
  const [shippingMode, setShippingMode] = useState(movement.shipping_mode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = canCreatorEdit(movement.status);
  const canCancel = canCreatorCancel(movement.status, movement.movement_head);

  if (!canEdit && !canCancel) return null;

  async function submit(action: "resubmit" | "cancel") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/movements/${movement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "cancel"
            ? { action: "cancel" }
            : {
                action: "resubmit",
                from_sku: fromSku,
                from_country: fromCountry,
                to_sku: toSku,
                to_country: toCountry,
                quantity: Number(quantity),
                shipping_mode: shippingMode,
              },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Creator actions</h3>
      {canEdit && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-gray-500">From SKU</span>
            <input className="input w-full" value={fromSku} onChange={(e) => setFromSku(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">From country</span>
            <select className="input w-full" value={fromCountry} onChange={(e) => setFromCountry(e.target.value)}>
              {MOVEMENT_COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">To SKU</span>
            <input className="input w-full" value={toSku} onChange={(e) => setToSku(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">To country</span>
            <select className="input w-full" value={toCountry} onChange={(e) => setToCountry(e.target.value)}>
              {MOVEMENT_COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Quantity</span>
            <input type="number" min={1} className="input w-full" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Shipping</span>
            <select className="input w-full" value={shippingMode} onChange={(e) => setShippingMode(e.target.value as typeof shippingMode)}>
              <option value="road">By Road</option>
              <option value="air">By Air</option>
              <option value="sea">By Sea</option>
            </select>
          </label>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <button type="button" disabled={loading} className="btn-primary" onClick={() => void submit("resubmit")}>
            Save & resubmit
          </button>
        )}
        {canCancel && (
          <button type="button" disabled={loading} className="btn-secondary" onClick={() => void submit("cancel")}>
            Cancel request
          </button>
        )}
      </div>
    </div>
  );
}
