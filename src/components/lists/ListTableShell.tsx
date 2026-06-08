"use client";

import type { ReactNode } from "react";

interface ListTableShellProps {
  children: ReactNode;
}

export function ListTableShell({ children }: ListTableShellProps) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

interface ListEmptyStateProps {
  message?: string;
  action?: ReactNode;
}

export function ListEmptyState({ message = "No records found.", action }: ListEmptyStateProps) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-gray-500">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

interface ListSkeletonProps {
  rows?: number;
  cols?: number;
}

export function ListSkeleton({ rows = 5, cols = 6 }: ListSkeletonProps) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((__, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-gray-200" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
