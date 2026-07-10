"use client";

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export function ListPagination({
  currentPage,
  totalPages,
  totalItems,
  itemLabel = "records",
  onPageChange,
}: ListPaginationProps) {
  if (totalPages <= 1 && totalItems === 0) return null;

  return (
    <div className="flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {totalItems} {itemLabel}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="btn-secondary disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="btn-secondary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Never synced";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SyncStatusBar({
  lastSyncedAt,
  syncing,
  warning,
}: {
  lastSyncedAt: string | null;
  syncing?: boolean;
  warning?: string | null;
}) {
  return (
    <div className="space-y-1 text-xs text-gray-500">
      <p>
        {syncing ? "Syncing from Metabase…" : `Last synced: ${formatSyncedAt(lastSyncedAt)}`}
      </p>
      {warning && <p className="text-amber-600">{warning}</p>}
    </div>
  );
}
