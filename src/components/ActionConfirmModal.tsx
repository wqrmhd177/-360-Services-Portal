"use client";

import React from "react";

export type ActionConfirmVariant = "approve" | "reject" | "verify";

interface ActionConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  variant: ActionConfirmVariant;
  remarks: string;
  onRemarksChange: (value: string) => void;
  remarksLabel?: string;
  remarksRequired?: boolean;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles: Record<
  ActionConfirmVariant,
  { button: string; iconBg: string; iconColor: string }
> = {
  approve: {
    button: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  reject: {
    button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
  },
  verify: {
    button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
};

export default function ActionConfirmModal({
  open,
  title,
  description,
  variant,
  remarks,
  onRemarksChange,
  remarksLabel = "Remarks (optional)",
  remarksRequired = false,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ActionConfirmModalProps) {
  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div
          className="fixed inset-0 bg-gray-500/75 transition-opacity"
          onClick={() => !loading && onCancel()}
        />
        <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {description && (
            <p className="mt-2 text-sm text-gray-600">{description}</p>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {remarksLabel}
              {remarksRequired && <span className="text-red-500"> *</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => onRemarksChange(e.target.value)}
              disabled={loading}
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Add any comments or notes..."
            />
          </div>
          <div className="mt-5 flex gap-3 justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || (remarksRequired && !remarks.trim())}
              onClick={onConfirm}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${styles.button}`}
            >
              {loading ? "Processing..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
