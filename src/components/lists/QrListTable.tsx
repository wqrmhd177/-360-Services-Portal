"use client";

import Link from "next/link";
import type { Qr } from "@/types/workflows";
import {
  formatDate,
  formatQrStatusLabel,
  summarizeDestinations,
  summarizeProducts,
} from "@/lib/format";
import { qrHasPendingMovement } from "@/lib/qrPurchaseDetails";
import PendingMovementSummary from "@/components/PendingMovementSummary";

function addWorkingDays(fromDate: Date, workingDays: number): Date {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < workingDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function canConvertQrToPr(qr: Qr): boolean {
  if (qr.status !== "responded") return false;
  const updatedAt = qr.updated_at;
  if (!updatedAt) return true;
  const from = new Date(updatedAt);
  const eligibleFrom = addWorkingDays(from, 3);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eligibleFrom.setHours(0, 0, 0, 0);
  return today < eligibleFrom;
}

function isQrReEdited(qr: Qr): boolean {
  const procurementResponse =
    qr.procurement_response && typeof qr.procurement_response === "object"
      ? qr.procurement_response
      : null;
  const metadata = procurementResponse ? (procurementResponse as { _metadata?: { editCount?: number } })._metadata : null;
  return !!(metadata && metadata.editCount && metadata.editCount > 0);
}

interface QrListTableProps {
  qrs: Qr[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (id: string) => void;
  showConvertAction?: boolean;
  showCheckbox?: boolean;
  respondLink?: (qr: Qr) => { href: string; label: string } | null;
}

export default function QrListTable({
  qrs,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onView,
  showConvertAction = false,
  showCheckbox = true,
  respondLink,
}: QrListTableProps) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-gray-200 bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
        <tr>
          {showCheckbox && (
            <th className="px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.size === qrs.length && qrs.length > 0}
                onChange={onSelectAll}
                className="rounded border-gray-300"
                aria-label="Select all"
              />
            </th>
          )}
          <th className="px-4 py-3 font-medium">QR Number</th>
          <th className="px-4 py-3 font-medium">Product</th>
          <th className="px-4 py-3 font-medium">Seller</th>
          <th className="px-4 py-3 font-medium">Destinations</th>
          <th className="px-4 py-3 font-medium text-center">Status</th>
          <th className="px-4 py-3 font-medium">Created</th>
          <th className="px-4 py-3 font-medium text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {qrs.map((qr) => {
          const reEdited = isQrReEdited(qr);
          const hasPendingMovement = qrHasPendingMovement(qr);
          const link = respondLink?.(qr);
          return (
            <tr
              key={qr.id}
              className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50 ${
                reEdited ? "bg-yellow-50/40" : hasPendingMovement ? "bg-amber-50/30" : ""
              }`}
            >
              {showCheckbox && (
                <td className="px-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(qr.id)}
                    onChange={() => onSelectOne(qr.id)}
                    className="rounded border-gray-300"
                    aria-label={`Select ${qr.qr_number || qr.id}`}
                  />
                </td>
              )}
              <td className="px-4 py-3 align-middle whitespace-nowrap">
                <span className="font-mono text-xs font-semibold text-gray-900">
                  {qr.qr_number || "—"}
                </span>
              </td>
              <td className="px-4 py-3 align-middle text-gray-900">
                {summarizeProducts(qr.purchase_details)}
              </td>
              <td className="px-4 py-3 align-middle whitespace-nowrap text-gray-700">
                {qr.reseller_code || "—"}
              </td>
              <td className="px-4 py-3 align-middle text-gray-600">
                {summarizeDestinations(qr.purchase_details)}
              </td>
              <td className="px-4 py-3 align-middle text-center">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="badge">{formatQrStatusLabel(qr.status)}</span>
                  {hasPendingMovement && <PendingMovementSummary qr={qr} compact />}
                  {reEdited && (
                    <span className="badge border-yellow-500 bg-yellow-50 text-yellow-700 text-[10px]">
                      Re-edited
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-gray-500">
                {formatDate(qr.created_at)}
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onView(qr.id)}
                    className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    aria-label={`View ${qr.qr_number || "QR"}`}
                    title="View details"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  {showConvertAction && qr.status === "responded" && (
                    canConvertQrToPr(qr) ? (
                      <Link
                        href={`/dashboard/growth/qr/${qr.id}/convert`}
                        className="text-xs font-medium text-portal-700 hover:text-portal-900"
                      >
                        Convert
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-amber-700" title="Reconfirm rates with Procurement">
                        Reconfirm
                      </span>
                    )
                  )}
                  {link && (
                    <Link href={link.href} className="text-xs font-medium text-portal-700 hover:text-portal-900">
                      {link.label}
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
