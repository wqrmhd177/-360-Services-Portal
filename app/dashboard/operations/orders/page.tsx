"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShoppingCart } from "lucide-react";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { SyncStatusBar } from "@/components/lists/ListPagination";

export default function OperationsOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/orders?page=1&limit=25");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load orders status");
        return;
      }
      setConfigured(Boolean(data.configured));
      setMessage(data.message ?? "");
      setLastSyncedAt(data.lastSyncedAt ?? null);
      setRowCount(data.total ?? 0);
    } catch {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/operations/orders/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.hint || "Sync failed");
        return;
      }
      setRowCount(data.rowCount ?? 0);
      setLastSyncedAt(data.syncedAt ?? new Date().toISOString());
      await load();
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ListPageHeader
        title="Orders"
        subtitle="Operational orders synced from Metabase into Supabase"
        actions={
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading || !configured}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            title={configured ? "Sync orders from Metabase" : "Configure METABASE_OPERATIONS_ORDERS_URL first"}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync
          </button>
        }
      />

      <SyncStatusBar lastSyncedAt={lastSyncedAt} syncing={syncing} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="mb-4 h-14 w-14 text-gray-300" />
          <p className="text-base font-medium text-gray-600">
            {configured
              ? rowCount > 0
                ? `${rowCount} orders cached — table UI coming next`
                : "No orders cached yet — click Sync to load from Metabase"
              : "Orders Metabase URL not configured"}
          </p>
          {message && <p className="mt-2 max-w-lg text-sm text-gray-500">{message}</p>}
          {!configured && (
            <p className="mt-3 text-xs text-gray-400">
              Add <code className="rounded bg-gray-100 px-1">METABASE_OPERATIONS_ORDERS_URL</code> in Vercel
              environment variables, then run <code className="rounded bg-gray-100 px-1">setup_operations_cache.sql</code> in Supabase.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
