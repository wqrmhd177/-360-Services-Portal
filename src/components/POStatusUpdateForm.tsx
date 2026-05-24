"use client";

import { useState } from "react";

interface POStatusUpdateFormProps {
  poId: string;
  currentStatus: string;
  statusOptions: string[];
  statusLabels: Record<string, string>;
}

export default function POStatusUpdateForm({
  poId,
  currentStatus,
  statusOptions,
  statusLabels,
}: POStatusUpdateFormProps) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedStatus(value);
    setShowCancelReason(value === "canceled");
  };

  return (
    <form action={`/api/procurement/po/${poId}/update-status`} method="POST" className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Select New Status
          </label>
          <select
            name="status"
            required
            value={selectedStatus}
            onChange={handleStatusChange}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          >
            <option value="">Choose a status...</option>
            {statusOptions.map((status) => {
              if (status === currentStatus) return null;
              return (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              );
            })}
          </select>
        </div>
        <button type="submit" className="btn-primary whitespace-nowrap">
          Update Status
        </button>
      </div>
      {showCancelReason && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Cancellation Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            name="cancel_reason"
            rows={2}
            required
            placeholder="Please provide a reason for cancellation..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          />
        </div>
      )}
    </form>
  );
}
