"use client";

import { useState } from "react";
import {
  countryDetailTotal,
  getRequestedQuantity,
  getPurchaseDetailLabel,
  type MovementSplit,
} from "@/lib/qrPurchaseDetails";

type CountryDetail = {
  country: string;
  quantity: number;
  unitPrice?: number;
  targetPrice?: number;
  totalPrice?: number;
  currency?: "AED" | "SAR" | "PKR";
};

type Detail = {
  productName?: string;
  fromSku?: string;
  toSku?: string;
  countryDetails?: CountryDetail[];
  quantity?: number;
  unitPrice?: number;
  targetPrice?: number;
  movementSplits?: MovementSplit[];
};

type Props = {
  qrId: string;
  detailIndex: number;
  detail: Detail;
  inventoryAvailable?: number;
  editable?: boolean;
  onUpdated?: (purchaseDetails: unknown[]) => void;
};

export default function MovementsPostResponsePanel({
  qrId,
  detailIndex,
  detail,
  inventoryAvailable,
  editable = false,
  onUpdated,
}: Props) {
  const requestedQty = getRequestedQuantity(detail);
  const label = getPurchaseDetailLabel(detail);
  const hasMismatch =
    inventoryAvailable != null && inventoryAvailable !== requestedQty;

  const defaultUnitPrice =
    detail.countryDetails?.[0]?.unitPrice ??
    detail.countryDetails?.[0]?.targetPrice ??
    detail.unitPrice ??
    detail.targetPrice ??
    0;

  const [readyQty, setReadyQty] = useState(
    detail.movementSplits?.find((s) => s.status === "ready")?.quantity ??
      (hasMismatch ? Math.min(inventoryAvailable ?? 0, requestedQty) : requestedQty)
  );
  const [pendingQty, setPendingQty] = useState(
    detail.movementSplits?.find((s) => s.status === "pending")?.quantity ??
      (hasMismatch ? requestedQty - Math.min(inventoryAvailable ?? 0, requestedQty) : 0)
  );
  const [countryDetails, setCountryDetails] = useState<CountryDetail[]>(
    (detail.countryDetails ?? []).map((cd) => ({
      ...cd,
      unitPrice: cd.unitPrice ?? cd.targetPrice ?? defaultUnitPrice,
    }))
  );
  const [saving, setSaving] = useState<"split" | "prices" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function saveSplit() {
    setSaving("split");
    setError(null);
    setSuccess(null);
    try {
      const splits: MovementSplit[] = [
        {
          id: detail.movementSplits?.find((s) => s.status === "ready")?.id ?? `ready-${Date.now()}`,
          quantity: readyQty,
          unitPrice: defaultUnitPrice,
          totalPrice: countryDetailTotal(readyQty, defaultUnitPrice),
          status: "ready",
        },
        {
          id: detail.movementSplits?.find((s) => s.status === "pending")?.id ?? `pending-${Date.now()}`,
          quantity: pendingQty,
          unitPrice: defaultUnitPrice,
          totalPrice: countryDetailTotal(pendingQty, defaultUnitPrice),
          status: "pending",
        },
      ];
      const res = await fetch(`/api/growth/qr/${qrId}/movements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseDetailIndex: detailIndex,
          action: "split",
          movementSplits: splits,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save split");
        return;
      }
      setSuccess("Movement split saved.");
      onUpdated?.(data.purchase_details);
    } catch {
      setError("Failed to save split");
    } finally {
      setSaving(null);
    }
  }

  async function savePrices() {
    setSaving("prices");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/growth/qr/${qrId}/movements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseDetailIndex: detailIndex,
          action: "updatePrices",
          countryDetails: countryDetails.map((cd) => ({
            ...cd,
            totalPrice: countryDetailTotal(cd.quantity, cd.unitPrice ?? 0),
            targetPrice: cd.unitPrice,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save prices");
        return;
      }
      setSuccess("Unit prices updated.");
      onUpdated?.(data.purchase_details);
    } catch {
      setError("Failed to save prices");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-2 rounded border border-indigo-200 bg-indigo-50/40 p-2 text-[10px]">
      <div className="font-semibold text-indigo-900 mb-1">Movements — {label}</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <span className="text-gray-500">Requested:</span>{" "}
          <span className="font-medium">{requestedQty} units</span>
        </div>
        <div>
          <span className="text-gray-500">Inventory Available:</span>{" "}
          <span className={`font-medium ${hasMismatch ? "text-amber-700" : "text-gray-900"}`}>
            {inventoryAvailable != null ? `${inventoryAvailable} units` : "—"}
          </span>
        </div>
      </div>

      {detail.movementSplits && detail.movementSplits.length > 0 && (
        <div className="mb-2 space-y-1">
          {detail.movementSplits.map((split) => (
            <div key={split.id} className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                  split.status === "ready"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {split.status === "ready" ? "Ready" : "Pending"}
              </span>
              <span>
                {split.quantity} units · {Number(split.unitPrice).toFixed(2)} / unit · Total{" "}
                {Number(split.totalPrice).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {editable && hasMismatch && !detail.movementSplits?.length && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2">
          <div className="font-medium text-amber-900 mb-1">Split movement</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[9px] text-gray-600">Ready qty</label>
              <input
                type="number"
                min={0}
                max={inventoryAvailable ?? requestedQty}
                value={readyQty}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setReadyQty(v);
                  setPendingQty(Math.max(0, requestedQty - v));
                }}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-600">Pending qty</label>
              <input
                type="number"
                min={0}
                value={pendingQty}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setPendingQty(v);
                  setReadyQty(Math.max(0, requestedQty - v));
                }}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={saveSplit}
              disabled={saving === "split"}
              className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving === "split" ? "Saving..." : "Save split"}
            </button>
          </div>
        </div>
      )}

      {editable && countryDetails.length > 0 && (
        <div className="mb-2 rounded border border-gray-200 bg-white p-2">
          <div className="font-medium text-gray-800 mb-1">Update unit price</div>
          {countryDetails.map((cd, i) => (
            <div key={cd.country} className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-gray-600">{cd.country}:</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={cd.unitPrice ?? ""}
                onChange={(e) => {
                  const unitPrice = Number(e.target.value) || 0;
                  setCountryDetails((prev) => {
                    const next = [...prev];
                    next[i] = {
                      ...next[i],
                      unitPrice,
                      totalPrice: countryDetailTotal(next[i].quantity, unitPrice),
                    };
                    return next;
                  });
                }}
                className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <span className="text-gray-500">
                Total: {countryDetailTotal(cd.quantity, cd.unitPrice ?? 0).toFixed(2)}{" "}
                {cd.currency ?? "AED"}
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={savePrices}
            disabled={saving === "prices"}
            className="mt-1 rounded bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving === "prices" ? "Saving..." : "Save prices"}
          </button>
        </div>
      )}

      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-700">{success}</div>}
    </div>
  );
}
