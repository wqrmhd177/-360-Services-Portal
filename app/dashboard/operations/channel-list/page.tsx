"use client";

import { ExternalLink, Loader2, Radio, RefreshCw } from "lucide-react";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { ListPagination, SyncStatusBar } from "@/components/lists/ListPagination";
import { useOperationsListPage } from "@/hooks/useOperationsListPage";
import type { ChannelListRow } from "@/lib/operations/channelList";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export default function ChannelListPage() {
  const {
    items: channels,
    loading,
    syncing,
    bootstrapping,
    error,
    warning,
    search,
    setSearch,
    currentPage,
    setCurrentPage,
    totalPages,
    total,
    lastSyncedAt,
    runSync,
  } = useOperationsListPage<ChannelListRow>({
    apiPath: "/api/operations/channel-list",
    syncPath: "/api/operations/channel-list/sync",
    itemsKey: "channels",
  });

  const busy = loading || syncing || bootstrapping;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Channel List"
        subtitle="Stores and channels cached in Supabase for fast access"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by store name, store link, store ID, or user ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full sm:w-72"
            />
            <button
              type="button"
              onClick={runSync}
              disabled={busy}
              className="btn-primary inline-flex shrink-0 items-center gap-2 disabled:opacity-60"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync
            </button>
          </div>
        }
      />

      <SyncStatusBar
        lastSyncedAt={lastSyncedAt}
        syncing={syncing}
        bootstrapping={bootstrapping}
        warning={warning}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {busy && channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-portal-500" />
          <p className="text-sm text-gray-600">
            {bootstrapping ? "Loading initial channel list from Metabase…" : "Loading channels…"}
          </p>
        </div>
      ) : channels.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Radio className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {total === 0 && !search.trim()
              ? "No channels found"
              : "No channels match your search"}
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 text-center">Store ID</th>
                    <th className="px-4 py-3 text-center">User ID</th>
                    <th className="px-4 py-3 text-left">Store Name</th>
                    <th className="px-4 py-3 text-left">Store Link</th>
                    <th className="px-4 py-3 text-center">Platform</th>
                    <th className="px-4 py-3 text-center">Bifurcation</th>
                    <th className="px-4 py-3 text-center">Confirmation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {channels.map((row) => (
                    <tr key={`${row.store_id}-${row.user_id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center text-gray-700">{row.store_id}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.user_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.store_name}</td>
                      <td className="max-w-xs px-4 py-3 text-gray-600">
                        {isHttpUrl(row.store_url) ? (
                          <a
                            href={row.store_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 truncate text-portal-600 hover:text-portal-800 hover:underline"
                          >
                            <span className="truncate">{row.store_url}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="truncate">{row.store_url || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.platform || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.bifurcation || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {row.confirmation_setting || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemLabel="channels"
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
