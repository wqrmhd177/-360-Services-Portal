"use client";

import React from "react";
import { PoStatusHistoryEntry } from "@/types/workflows";

interface StatusTimelineProps {
  statusHistory: PoStatusHistoryEntry[];
  className?: string;
}

export default function StatusTimeline({
  statusHistory,
  className = "",
}: StatusTimelineProps) {
  if (!statusHistory || statusHistory.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No status history available
      </div>
    );
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatStatus = (status: string): string => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className={`flow-root ${className}`}>
      <ul className="-mb-8">
        {statusHistory.map((entry, idx) => (
          <li key={idx}>
            <div className="relative pb-8">
              {idx !== statusHistory.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                    <svg
                      className="h-5 w-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatStatus(entry.status)}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDate(entry.timestamp)}
                    </p>
                  </div>
                  {entry.changed_by && (
                    <p className="mt-1 text-xs text-gray-600">
                      by {entry.changed_by}
                    </p>
                  )}
                  {entry.remarks && (
                    <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {entry.remarks}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
