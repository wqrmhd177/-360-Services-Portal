"use client";

import { useState } from "react";
import type { MovementRequest } from "@/types/movements";
import { canApproverAct } from "@/lib/movements/status";

export function MovementApproverPanel({
  movement,
  onUpdated,
}: {
  movement: MovementRequest;
  onUpdated: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canApproverAct(movement.movement_head, movement.status)) return null;

  async function act(approve: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/movements/${movement.id}/${approve ? "approve" : "reject"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Approver action</h3>
      <textarea
        className="input w-full min-h-[4rem]"
        placeholder="Remarks (optional)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={loading} className="btn-primary" onClick={() => void act(true)}>
          Approve
        </button>
        <button type="button" disabled={loading} className="btn-secondary" onClick={() => void act(false)}>
          Reject
        </button>
      </div>
    </div>
  );
}
