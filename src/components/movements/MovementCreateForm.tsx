"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { MovementHead, MovementShippingMode } from "@/types/movements";
import { MOVEMENT_COUNTRY_OPTIONS } from "@/types/movements";
import { isPhase2MovementHead } from "@/lib/movements/status";

type LineState = {
  sku: string;
  country: string;
  productName: string;
  availableQty: number | null;
  loading: boolean;
};

const HEAD_OPTIONS: { value: MovementHead; label: string }[] = [
  { value: "partner", label: "Partner" },
  { value: "gold_to_gold", label: "Gold to Gold" },
  { value: "360_seller_inventory", label: "360 Movements" },
];

const SUB_360_OPTIONS: { value: MovementHead; label: string }[] = [
  { value: "360_seller_inventory", label: "Seller Inventory" },
  { value: "360_zambeel_inventory", label: "Zambeel Inventory" },
];

const SHIPPING_OPTIONS: { value: MovementShippingMode; label: string }[] = [
  { value: "road", label: "By Road" },
  { value: "air", label: "By Air" },
  { value: "sea", label: "By Sea" },
];

function emptyLine(): LineState {
  return { sku: "", country: "United Arab Emirates", productName: "", availableQty: null, loading: false };
}

function SkuCountryRow({
  label,
  line,
  onChange,
}: {
  label: string;
  line: LineState;
  onChange: Dispatch<SetStateAction<LineState>>;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const requestIdRef = useRef(0);

  const runLookup = useCallback(async (sku: string, country: string) => {
    const trimmedSku = sku.trim();
    const trimmedCountry = country.trim();
    if (!trimmedSku || !trimmedCountry) return;

    const reqId = ++requestIdRef.current;
    onChangeRef.current((prev) => ({ ...prev, loading: true }));

    try {
      const params = new URLSearchParams({ sku: trimmedSku, country: trimmedCountry });
      const res = await fetch(`/api/movements/inventory-lookup?${params.toString()}`);
      const json = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");

      onChangeRef.current((prev) => {
        if (prev.sku.trim() !== trimmedSku || prev.country.trim() !== trimmedCountry) {
          return { ...prev, loading: false };
        }
        return {
          ...prev,
          loading: false,
          productName: json.product_name ?? "",
          availableQty: json.found ? Number(json.available_quantity) : 0,
        };
      });
    } catch {
      if (reqId !== requestIdRef.current) return;
      onChangeRef.current((prev) => {
        if (prev.sku.trim() !== trimmedSku || prev.country.trim() !== trimmedCountry) {
          return { ...prev, loading: false };
        }
        return { ...prev, loading: false, productName: "", availableQty: null };
      });
    }
  }, []);

  useEffect(() => {
    const trimmedSku = line.sku.trim();
    if (trimmedSku.length < 3) return;

    const timer = setTimeout(() => {
      void runLookup(line.sku, line.country);
    }, 500);

    return () => clearTimeout(timer);
  }, [line.sku, line.country, runLookup]);

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-500">SKU</span>
          <input
            type="text"
            value={line.sku}
            onChange={(e) => onChange((prev) => ({ ...prev, sku: e.target.value }))}
            className="input w-full"
            placeholder="Enter SKU"
          />
        </label>
        <label className="block min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-500">Country</span>
          <select
            value={line.country}
            onChange={(e) => onChange((prev) => ({ ...prev, country: e.target.value }))}
            className="input w-full"
          >
            {MOVEMENT_COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void runLookup(line.sku, line.country)}
          disabled={line.loading || !line.sku.trim()}
          className="btn-secondary min-w-[9.5rem] shrink-0 disabled:opacity-60"
        >
          {line.loading ? "Checking…" : "Check inventory"}
        </button>
      </div>
      <div className="flex min-h-[1.25rem] flex-wrap gap-4 text-sm">
        <span>
          <span className="text-gray-500">Product: </span>
          <span className="font-medium">{line.loading ? "…" : line.productName || "—"}</span>
        </span>
        <span>
          <span className="text-gray-500">Available: </span>
          <span className="font-medium tabular-nums">
            {line.loading ? "…" : line.availableQty != null ? line.availableQty : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function MovementCreateForm({ onSuccess }: { onSuccess: (id: string) => void }) {
  const [head, setHead] = useState<MovementHead>("partner");
  const [sub360, setSub360] = useState<MovementHead>("360_seller_inventory");
  const [from, setFrom] = useState<LineState>(emptyLine());
  const [to, setTo] = useState<LineState>(emptyLine());
  const [quantity, setQuantity] = useState("");
  const [shippingMode, setShippingMode] = useState<MovementShippingMode>("road");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveHead = head === "360_seller_inventory" ? sub360 : head;
  const is360 = head === "360_seller_inventory";
  const phase2Blocked = is360 && isPhase2MovementHead(effectiveHead);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase2Blocked) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movement_head: effectiveHead,
          from_sku: from.sku.trim(),
          from_country: from.country.trim(),
          from_product_name: from.productName || null,
          to_sku: to.sku.trim(),
          to_country: to.country.trim(),
          to_product_name: to.productName || null,
          quantity: Number(quantity),
          shipping_mode: shippingMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create movement");
      onSuccess(json.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create movement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Movement type</span>
          <select
            value={head}
            onChange={(e) => setHead(e.target.value as MovementHead)}
            className="input w-full"
          >
            {HEAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {is360 && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">360 option</span>
            <select
              value={sub360}
              onChange={(e) => setSub360(e.target.value as MovementHead)}
              className="input w-full"
            >
              {SUB_360_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {phase2Blocked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          360 Movements (Seller Inventory / Zambeel Inventory) will be available in the next
          phase.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Movement Details</h3>
            <SkuCountryRow label="From" line={from} onChange={setFrom} />
            <SkuCountryRow label="To" line={to} onChange={setTo} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Quantity</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Shipping mode</span>
                <select
                  value={shippingMode}
                  onChange={(e) => setShippingMode(e.target.value as MovementShippingMode)}
                  className="input w-full"
                >
                  {SHIPPING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
            {loading ? "Submitting…" : "Submit"}
          </button>
        </>
      )}
    </form>
  );
}
