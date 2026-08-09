"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MovementApproverPanel } from "@/components/movements/MovementApproverPanel";
import { MovementCreatorResubmitForm } from "@/components/movements/MovementCreatorResubmitForm";
import { MovementProcurementPanel } from "@/components/movements/MovementProcurementPanel";
import type { MovementRequest, MovementRequestLog } from "@/types/movements";
import {
  MOVEMENT_HEAD_LABELS,
  MOVEMENT_STATUS_LABELS,
  SHIPPING_MODE_LABELS,
} from "@/types/movements";
import { formatDate } from "@/lib/format";

export default function MovementDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [movement, setMovement] = useState<MovementRequest | null>(null);
  const [logs, setLogs] = useState<MovementRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/movements/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setMovement(json.movement);
      setLogs(json.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setMovement(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading movement…</p>;
  }

  if (error || !movement) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error ?? "Not found"}</p>
        <Link href="/dashboard/movements" className="btn-secondary">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{movement.movement_number}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {MOVEMENT_HEAD_LABELS[movement.movement_head]} ·{" "}
            {MOVEMENT_STATUS_LABELS[movement.status]}
          </p>
        </div>
        <Link href="/dashboard/movements" className="btn-secondary">
          Back to list
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900">Movement details</h3>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">From</dt>
            <dd className="font-medium">
              {movement.from_sku} · {movement.from_country}
              {movement.from_product_name && (
                <span className="block text-gray-500 font-normal">{movement.from_product_name}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">To</dt>
            <dd className="font-medium">
              {movement.to_sku} · {movement.to_country}
              {movement.to_product_name && (
                <span className="block text-gray-500 font-normal">{movement.to_product_name}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Quantity</dt>
            <dd className="font-medium tabular-nums">{movement.quantity}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Shipping</dt>
            <dd className="font-medium">{SHIPPING_MODE_LABELS[movement.shipping_mode]}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created by</dt>
            <dd>{movement.created_by_email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd>{formatDate(movement.created_at)}</dd>
          </div>
          {movement.approver_email && (
            <div>
              <dt className="text-gray-500">Approver</dt>
              <dd>
                {movement.approver_email}
                {movement.approver_remarks && ` — ${movement.approver_remarks}`}
              </dd>
            </div>
          )}
          {movement.procurement_email && (
            <div>
              <dt className="text-gray-500">Procurement</dt>
              <dd>
                {movement.procurement_email}
                {movement.procurement_remarks && ` — ${movement.procurement_remarks}`}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <MovementCreatorResubmitForm movement={movement} onUpdated={load} />
      <MovementApproverPanel movement={movement} onUpdated={load} />
      <MovementProcurementPanel movement={movement} onUpdated={load} />

      {logs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-gray-900">Activity log</h3>
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="border-b border-gray-100 pb-2 last:border-0">
                <span className="font-medium">{log.action}</span>
                <span className="text-gray-500"> · {log.actor_email}</span>
                {log.from_status && log.to_status && (
                  <span className="text-gray-500">
                    {" "}
                    ({log.from_status} → {log.to_status})
                  </span>
                )}
                {log.remarks && <p className="text-gray-600">{log.remarks}</p>}
                <p className="text-xs text-gray-400">{formatDate(log.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
