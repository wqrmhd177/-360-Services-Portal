"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LoadResult<T> = {
  items: T[];
  total: number;
  totalPages: number;
  lastSyncedAt: string | null;
  warning: string | null;
  needsSync: boolean;
};

type UseOperationsListPageOptions = {
  apiPath: string;
  syncPath: string;
  itemsKey: "items" | "channels";
  itemsPerPage?: number;
};

export function useOperationsListPage<T>({
  apiPath,
  syncPath,
  itemsKey,
  itemsPerPage = 25,
}: UseOperationsListPageOptions) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const bootstrapAttempted = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const load = useCallback(
    async (page: number, q: string): Promise<LoadResult<T> | null> => {
      setLoading(true);
      setError("");
      setWarning(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(itemsPerPage),
          search: q,
        });
        const res = await fetch(`${apiPath}?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || data.hint || "Failed to load data");
          return null;
        }

        const nextItems = (Array.isArray(data[itemsKey]) ? data[itemsKey] : []) as T[];
        setItems(nextItems);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setLastSyncedAt(data.lastSyncedAt ?? null);
        if (data.warning) setWarning(data.warning);

        return {
          items: nextItems,
          total: data.total ?? 0,
          totalPages: data.totalPages ?? 1,
          lastSyncedAt: data.lastSyncedAt ?? null,
          warning: data.warning ?? null,
          needsSync: Boolean(data.needsSync),
        };
      } catch {
        setError("Failed to load data");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiPath, itemsKey, itemsPerPage]
  );

  const runSync = useCallback(async () => {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(syncPath, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.hint || "Sync failed");
        return false;
      }
      setCurrentPage(1);
      await load(1, debouncedSearch);
      return true;
    } catch {
      setError("Sync failed");
      return false;
    } finally {
      setSyncing(false);
      setBootstrapping(false);
    }
  }, [syncPath, load, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndMaybeBootstrap() {
      const result = await load(currentPage, debouncedSearch);
      if (cancelled || !result) return;

      if (
        result.needsSync &&
        !debouncedSearch &&
        currentPage === 1 &&
        !bootstrapAttempted.current
      ) {
        bootstrapAttempted.current = true;
        setBootstrapping(true);
        await runSync();
      }
    }

    fetchAndMaybeBootstrap();
    return () => {
      cancelled = true;
    };
  }, [currentPage, debouncedSearch, load, runSync]);

  return {
    items,
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
  };
}
