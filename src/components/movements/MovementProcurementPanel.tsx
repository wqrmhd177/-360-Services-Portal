"use client";

import { useState } from "react";
import type { MovementRequest } from "@/types/movements";
import { canProcurementAct } from "@/lib/movements/status";

export function MovementProcurementPanel({
  movement,
  onUpdated,
}: {
  movement: MovementRequest;
  onUpdated: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canProcurementAct(movement.movement_head, movement.status)) return null;

  const showAccept = movement.status === "submitted" || movement.status === "approved";
  const showComplete = movement.status === "in_progress";
  const showReject =
    movement.status === "submitted" ||
    movement.status === "approved" ||
    movement.status === "in_progress";

  async function act(action: "accept" | "complete" | "reject") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/movements/${movement.id}/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, remarks }),
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
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Procurement action</h3>
      <textarea
        className="input w-full min-h-[4rem]"
        placeholder="Remarks (optional)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {showAccept && (
          <button type="button" disabled={loading} className="btn-primary" onClick={() => void act("accept")}>
            Accept / In progress
          </button>
        )}
        {showComplete && (
          <button type="button" disabled={loading} className="btn-primary" onClick={() => void act("complete")}>
            Mark completed
          </button>
        )}
        {showReject && (
          <button type="button" disabled={loading} className="btn-secondary" onClick={() => void act("reject")}>
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
