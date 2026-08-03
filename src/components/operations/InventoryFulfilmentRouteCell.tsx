"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { FulfilmentRouteHistoryModal } from "@/components/operations/FulfilmentRouteHistoryModal";

export function InventoryFulfilmentRouteCell({
  sku,
  route,
  routeOptions,
  isAdmin,
  onSaved,
}: {
  sku: string;
  route: string | null;
  routeOptions: string[];
  isAdmin: boolean;
  onSaved: (nextRoute: string) => void;
}) {
  const [value, setValue] = useState(route ?? "");
  const [customRoute, setCustomRoute] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setValue(route ?? "");
  }, [route]);

  const options = Array.from(
    new Set([...(routeOptions ?? []), route, value, customRoute].filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  const saveRoute = async (nextRoute: string) => {
    if (!nextRoute.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/operations/inventory/fulfilment-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, fulfilment_route: nextRoute.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save route");
      onSaved(nextRoute.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-600">{route?.trim() || "—"}</span>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="View route history"
        >
          <History className="h-3.5 w-3.5" />
        </button>
        <FulfilmentRouteHistoryModal
          sku={sku}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-w-[9rem] space-y-1">
      <div className="flex items-center gap-1">
        <select
          value={value}
          disabled={saving}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            void saveRoute(next);
          }}
          className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="">— Select route —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {saving ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" /> : null}
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="View route history"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={customRoute}
          onChange={(e) => setCustomRoute(e.target.value)}
          placeholder="Add new route…"
          className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-[10px]"
        />
        <button
          type="button"
          disabled={saving || !customRoute.trim()}
          onClick={() => {
            const next = customRoute.trim();
            setValue(next);
            setCustomRoute("");
            void saveRoute(next);
          }}
          className="rounded border border-gray-200 px-2 py-1 text-[10px] disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      <FulfilmentRouteHistoryModal
        sku={sku}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
