"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Radio, Search } from "lucide-react";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import type { ChannelListRow } from "@/lib/operations/channelList";
import { matchesChannelSearch } from "@/lib/operations/channelList";

const ITEMS_PER_PAGE = 25;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export default function ChannelListPage() {
  const [channels, setChannels] = useState<ChannelListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/channel-list");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load channel list");
        return;
      }
      setChannels(Array.isArray(data.channels) ? data.channels : []);
    } catch {
      setError("Failed to load channel list");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => channels.filter((row) => matchesChannelSearch(row, search)),
    [channels, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Channel List"
        subtitle="Stores and channels from Metabase"
        actions={
          <button type="button" onClick={load} className="btn-secondary" disabled={loading}>
            Refresh
          </button>
        }
      />

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by store name, store link, store ID, or user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Radio className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {channels.length === 0 ? "No channels found" : "No channels match your search"}
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
                  {paginated.map((row) => (
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {filtered.length} channel{filtered.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
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
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn-secondary disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
