"use client";

import Link from "next/link";
import type { Po } from "@/types/workflows";
import { formatDate, formatStatusLabel } from "@/lib/format";

function statusBadgeClass(status: string): string {
  if (status === "delivered") return "border-green-500 bg-green-50 text-green-700";
  if (status === "canceled") return "border-red-500 bg-red-50 text-red-700";
  return "border-blue-500 bg-blue-50 text-blue-700";
}

interface PoListTableProps {
  pos: Po[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (po: Po) => void;
  showCheckbox?: boolean;
  showCreatedBy?: boolean;
  showPaymentStatus?: boolean;
  viewHref?: (po: Po) => string | null;
  createdByNames?: Record<string, string>;
}

export default function PoListTable({
  pos,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onView,
  showCheckbox = true,
  showCreatedBy = false,
  showPaymentStatus = false,
  viewHref,
  createdByNames = {},
}: PoListTableProps) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-gray-200 bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
        <tr>
          {showCheckbox && (
            <th className="px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.size === pos.length && pos.length > 0}
                onChange={onSelectAll}
                className="rounded border-gray-300"
                aria-label="Select all"
              />
            </th>
          )}
          <th className="px-4 py-3 font-medium">PO Number</th>
          <th className="px-4 py-3 font-medium">PR Number</th>
          <th className="px-4 py-3 font-medium">Supplier</th>
          {showCreatedBy && <th className="px-4 py-3 font-medium">Created By</th>}
          <th className="px-4 py-3 font-medium">Status</th>
          {showPaymentStatus && <th className="px-4 py-3 font-medium">Payment</th>}
          <th className="px-4 py-3 font-medium">Created</th>
          <th className="px-4 py-3 font-medium text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {pos.map((po) => {
          const href = viewHref?.(po);
          return (
            <tr key={po.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              {showCheckbox && (
                <td className="px-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(po.id)}
                    onChange={() => onSelectOne(po.id)}
                    className="rounded border-gray-300"
                    aria-label={`Select ${po.po_number || po.id}`}
                  />
                </td>
              )}
              <td className="px-4 py-3 align-middle whitespace-nowrap">
                <span className="font-mono text-xs font-semibold text-gray-900">{po.po_number || "—"}</span>
              </td>
              <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-gray-700">
                {po.pr?.pr_number || "—"}
              </td>
              <td className="px-4 py-3 align-middle text-gray-900">{po.supplier_name || "—"}</td>
              {showCreatedBy && (
                <td className="px-4 py-3 align-middle text-xs text-gray-600">
                  {createdByNames[po.created_by_email] || po.created_by_email?.split("@")[0] || "—"}
                </td>
              )}
              <td className="px-4 py-3 align-middle">
                <span className={`badge capitalize ${statusBadgeClass(po.status)}`}>
                  {formatStatusLabel(po.status)}
                </span>
              </td>
              {showPaymentStatus && (
                <td className="px-4 py-3 align-middle">
                  <span
                    className={`badge text-[10px] ${
                      po.supplier_payment_status === "paid"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-yellow-500 bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {po.supplier_payment_status === "paid" ? "Paid" : "Unpaid"}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-gray-500">
                {formatDate(po.created_at)}
              </td>
              <td className="px-4 py-3 align-middle text-center">
                {href ? (
                  <Link
                    href={href}
                    className="text-xs font-medium text-portal-700 hover:text-portal-900"
                  >
                    View
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onView(po)}
                    className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    aria-label={`View ${po.po_number || "PO"}`}
                    title="View details"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
