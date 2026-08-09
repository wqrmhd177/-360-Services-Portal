"use client";

import Link from "next/link";
import type { MovementRequest } from "@/types/movements";
import {
  MOVEMENT_HEAD_LABELS,
  MOVEMENT_STATUS_LABELS,
  SHIPPING_MODE_LABELS,
} from "@/types/movements";
import { formatDate } from "@/lib/format";

export function MovementListTable({
  rows,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onView,
}: {
  rows: MovementRequest[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (id: string) => void;
}) {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  return (
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-3 text-left">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              aria-label="Select all"
            />
          </th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">Movement #</th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">Head</th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">From</th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">To</th>
          <th className="px-3 py-3 text-right font-medium text-gray-600">Qty</th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">Shipping</th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">Status</th>
          <th className="px-3 py-3 text-left font-medium text-gray-600">Created</th>
          <th className="px-3 py-3 text-center font-medium text-gray-600">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 bg-white">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-gray-50">
            <td className="px-3 py-2">
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => onSelectOne(row.id)}
                aria-label={`Select ${row.movement_number}`}
              />
            </td>
            <td className="px-3 py-2 font-mono text-xs">{row.movement_number}</td>
            <td className="px-3 py-2">{MOVEMENT_HEAD_LABELS[row.movement_head]}</td>
            <td className="px-3 py-2">
              <span className="font-mono text-xs">{row.from_sku}</span>
              <span className="text-gray-500"> · {row.from_country}</span>
            </td>
            <td className="px-3 py-2">
              <span className="font-mono text-xs">{row.to_sku}</span>
              <span className="text-gray-500"> · {row.to_country}</span>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
            <td className="px-3 py-2">{SHIPPING_MODE_LABELS[row.shipping_mode]}</td>
            <td className="px-3 py-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {MOVEMENT_STATUS_LABELS[row.status]}
              </span>
            </td>
            <td className="px-3 py-2 text-gray-500">{formatDate(row.created_at)}</td>
            <td className="px-3 py-2 text-center">
              <Link
                href={`/dashboard/movements/${row.id}`}
                className="text-teal-700 hover:underline"
                onClick={() => onView(row.id)}
              >
                View
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
