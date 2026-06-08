"use client";

import type { ReactNode } from "react";
import type { Pr } from "@/types/workflows";
import { formatDate, formatPrAmount, formatStatusLabel, getPrSeller, summarizePrProduct } from "@/lib/format";

function approvalBadgeClass(status: string): string {
  if (status === "approved") return "border-green-500 bg-green-50 text-green-700";
  if (status === "rejected") return "border-red-500 bg-red-50 text-red-700";
  if (status === "pending") return "border-yellow-500 bg-yellow-50 text-yellow-700";
  return "";
}

function financeBadgeClass(status: string): string {
  if (status === "verified") return "border-green-500 bg-green-50 text-green-700";
  if (status === "rejected") return "border-red-500 bg-red-50 text-red-700";
  return "border-gray-300 bg-gray-50 text-gray-600";
}

interface PrListTableProps {
  prs: Pr[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (pr: Pr) => void;
  showCheckbox?: boolean;
  showFinance?: boolean;
  showPoCreated?: boolean;
  extraActions?: (pr: Pr) => ReactNode;
}

export default function PrListTable({
  prs,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onView,
  showCheckbox = true,
  showFinance = true,
  showPoCreated = false,
  extraActions,
}: PrListTableProps) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-gray-200 bg-gray-50/80 text-xs uppercase tracking-wide text-gray-500">
        <tr>
          {showCheckbox && (
            <th className="px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.size === prs.length && prs.length > 0}
                onChange={onSelectAll}
                className="rounded border-gray-300"
                aria-label="Select all"
              />
            </th>
          )}
          <th className="px-4 py-3 font-medium">PR Number</th>
          <th className="px-4 py-3 font-medium">Product</th>
          <th className="px-4 py-3 font-medium">Seller</th>
          <th className="px-4 py-3 font-medium">Status</th>
          {showFinance && <th className="px-4 py-3 font-medium">Finance</th>}
          <th className="px-4 py-3 font-medium">Amount</th>
          {showPoCreated && <th className="px-4 py-3 font-medium">PO</th>}
          <th className="px-4 py-3 font-medium">Created</th>
          <th className="px-4 py-3 font-medium text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {prs.map((pr) => (
          <tr key={pr.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
            {showCheckbox && (
              <td className="px-4 py-3 align-middle">
                <input
                  type="checkbox"
                  checked={selectedIds.has(pr.id)}
                  onChange={() => onSelectOne(pr.id)}
                  className="rounded border-gray-300"
                  aria-label={`Select ${pr.pr_number || pr.id}`}
                />
              </td>
            )}
            <td className="px-4 py-3 align-middle whitespace-nowrap">
              <span className="font-mono text-xs font-semibold text-gray-900">{pr.pr_number || "—"}</span>
            </td>
            <td className="px-4 py-3 align-middle text-gray-900">{summarizePrProduct(pr)}</td>
            <td className="px-4 py-3 align-middle whitespace-nowrap text-gray-700">{getPrSeller(pr)}</td>
            <td className="px-4 py-3 align-middle">
              <span className={`badge capitalize ${approvalBadgeClass(pr.approval_status)}`}>
                {formatStatusLabel(pr.approval_status)}
              </span>
            </td>
            {showFinance && (
              <td className="px-4 py-3 align-middle">
                <span className={`badge capitalize ${financeBadgeClass(pr.finance_verification_status || "")}`}>
                  {formatStatusLabel(pr.finance_verification_status) || "—"}
                </span>
              </td>
            )}
            <td className="px-4 py-3 align-middle text-gray-700">{formatPrAmount(pr)}</td>
            {showPoCreated && (
              <td className="px-4 py-3 align-middle">
                {pr.po_created ? (
                  <span className="badge border-green-500 bg-green-50 text-green-700">Yes</span>
                ) : (
                  <span className="text-xs text-gray-400">No</span>
                )}
              </td>
            )}
            <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-gray-500">
              {formatDate(pr.created_at)}
            </td>
            <td className="px-4 py-3 align-middle">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onView(pr)}
                  className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  aria-label={`View ${pr.pr_number || "PR"}`}
                  title="View details"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {extraActions?.(pr)}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
