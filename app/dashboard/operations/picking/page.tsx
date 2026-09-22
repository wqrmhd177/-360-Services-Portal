"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { OperationsPageHeader } from "@/components/operations/OperationsPageHeader";
import {
  PickingAddProductDialog,
  PickingBulkUploadDialog,
  PickingDocumentDialog,
  PickingEditButton,
  PickingPictureLightbox,
} from "@/components/operations/PickingProductDialogs";
import { ListPagination } from "@/components/lists/ListPagination";
import { useOperationsListPage } from "@/hooks/useOperationsListPage";
import type { PickingProduct } from "@/lib/operations/picking";
import { formatPortalTimestamp } from "@/lib/portalTimezone";

type DocKind = "grn" | "awb";

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const snippet = text.trim().slice(0, 160);
    throw new Error(
      snippet.startsWith("<") || snippet.startsWith("Internal")
        ? `Picture sync failed (${res.status}). The server timed out or restarted — try Sync pictures again.`
        : snippet || `Picture sync failed (${res.status}).`,
    );
  }
}

function ProductThumb({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed border-gray-200 bg-white text-[10px] text-gray-400 ${className}`}
      >
        —
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onClick={onClick}
      className={onClick ? `${className} cursor-zoom-in` : className}
    />
  );
}

export default function ProductPicturesPage() {
  const {
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
    load,
  } = useOperationsListPage<PickingProduct>({
    apiPath: "/api/operations/picking",
    syncPath: "/api/operations/picking/sync",
    itemsKey: "items",
  });

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [grnDocOpen, setGrnDocOpen] = useState(false);
  const [pickingDocOpen, setPickingDocOpen] = useState(false);
  const [editing, setEditing] = useState<PickingProduct | null>(null);
  const [preview, setPreview] = useState<PickingProduct | null>(null);
  const [selected, setSelected] = useState<Record<string, PickingProduct>>({});
  const [imageSyncing, setImageSyncing] = useState(false);
  const [imageSyncMessage, setImageSyncMessage] = useState<string | null>(null);
  const [pendingPictures, setPendingPictures] = useState<number | null>(null);
  const [storedPictures, setStoredPictures] = useState<number | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const busy = loading || syncing || bootstrapping || imageSyncing;
  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedCount = selectedList.length;
  const allOnPageSelected =
    items.length > 0 && items.every((item) => Boolean(selected[item.sku]));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/operations/picking/sync-images")
      .then((res) => readApiJson(res))
      .then((json) => {
        if (cancelled || json.error) return;
        setPendingPictures(Number(json.pending ?? 0));
        setStoredPictures(Number(json.stored ?? 0));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [lastSyncedAt]);

  const syncPictures = async () => {
    setImageSyncing(true);
    setImageSyncMessage("Copying pictures into Supabase…");
    let copiedTotal = 0;
    let failedTotal = 0;
    let remainingNow: number | null = pendingPictures;
    const started = Date.now();
    const render = (remaining: number | null) => {
      const secs = Math.max(1, Math.round((Date.now() - started) / 1000));
      const rate = copiedTotal > 0 ? Math.round(copiedTotal / secs) : 0;
      setImageSyncMessage(
        `Copied ${copiedTotal.toLocaleString()} pictures` +
          (failedTotal ? `, ${failedTotal} failed` : "") +
          (remaining != null && remaining > 0
            ? ` · ${remaining.toLocaleString()} left`
            : "") +
          (rate ? ` · ${rate}/s` : ""),
      );
    };
    const tick = window.setInterval(() => render(remainingNow), 1000);
    try {
      for (let round = 0; round < 120; round += 1) {
        const res = await fetch("/api/operations/picking/sync-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxMs: 50_000,
            concurrency: 8,
            pageSize: 100,
          }),
        });
        const json = await readApiJson(res);
        if (!res.ok) {
          throw new Error(String(json.error ?? "Picture sync failed"));
        }
        copiedTotal += Number(json.copied ?? 0);
        failedTotal += Number(json.failed ?? 0);
        remainingNow = Number(json.remaining ?? 0);
        setPendingPictures(remainingNow);
        if (json.stored != null) setStoredPictures(Number(json.stored));
        render(remainingNow);
        if (remainingNow <= 0 || json.done) break;
        if (Number(json.copied ?? 0) === 0 && !json.timedOut) break;
      }
      if (failedTotal && (remainingNow ?? 0) > 0) {
        setImageSyncMessage(
          `Copied ${copiedTotal.toLocaleString()} pictures, ${failedTotal} failed. Share the Drive folder as Anyone with the link, then click Sync pictures again.`,
        );
      } else {
        render(remainingNow);
      }
      await load(currentPage, search);
    } catch (err) {
      setImageSyncMessage(
        err instanceof Error ? err.message : "Picture sync failed",
      );
    } finally {
      window.clearInterval(tick);
      setImageSyncing(false);
    }
  };

  const toggleRow = (product: PickingProduct) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[product.sku]) delete next[product.sku];
      else next[product.sku] = product;
      return next;
    });
  };

  const togglePage = () => {
    setSelected((prev) => {
      const next = { ...prev };
      if (allOnPageSelected) {
        for (const item of items) delete next[item.sku];
      } else {
        for (const item of items) next[item.sku] = item;
      }
      return next;
    });
  };

  const lookupProducts = async (skus: string[]) => {
    const res = await fetch("/api/operations/picking/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "SKU lookup failed");
    return (json.items as PickingProduct[]) ?? [];
  };

  const openDocumentHtml = (html: string) => {
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Allow pop-ups to open the document.");
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const generateDocumentFromLines = async (
    type: DocKind,
    docLines: Array<{
      sku: string;
      quantity: number;
      good_qty?: number | null;
      bad_qty?: number | null;
    }>,
    extraComments = "",
  ) => {
    if (docLines.length === 0) {
      throw new Error("Add at least one SKU before generating the document.");
    }
    const res = await fetch("/api/operations/picking/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        comments: extraComments,
        lines: docLines,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not generate document");
    openDocumentHtml(json.html as string);
  };

  const downloadSelection = async (type: DocKind) => {
    setDocBusy(true);
    setDocError(null);
    try {
      await generateDocumentFromLines(
        type,
        selectedList.map((item) => ({
          sku: item.sku,
          quantity: 1,
        })),
      );
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Could not generate document");
    } finally {
      setDocBusy(false);
    }
  };

  const downloadDocument = async (
    type: DocKind,
    payload: {
      lines: Array<{
        sku: string;
        quantity: number;
        good_qty?: number | null;
        bad_qty?: number | null;
      }>;
      comments: string;
    },
  ) => {
    setDocBusy(true);
    setDocError(null);
    try {
      await generateDocumentFromLines(type, payload.lines, payload.comments);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Could not generate document");
      throw err;
    } finally {
      setDocBusy(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <OperationsPageHeader
        title="Product Pictures"
        subtitle="Search SKUs, build GRN documents or picking lists, and download from selected rows."
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="SKUs or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-52 max-w-full rounded-xl border border-portal-200 bg-white px-3 text-sm text-portal-900 outline-none focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
        />
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn-secondary inline-flex h-9 shrink-0 items-center gap-1 px-2.5 text-xs"
        >
          <Plus className="h-4 w-4" />
          Add product
        </button>
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="btn-secondary inline-flex h-9 shrink-0 items-center gap-1 px-2.5 text-xs"
        >
          <Upload className="h-4 w-4" />
          Bulk pictures
        </button>
        <button
          type="button"
          onClick={() => setGrnDocOpen(true)}
          className="btn-secondary inline-flex h-9 shrink-0 items-center gap-1 px-2.5 text-xs"
        >
          <FileText className="h-4 w-4" />
          GRN Document
        </button>
        <button
          type="button"
          onClick={() => setPickingDocOpen(true)}
          className="btn-secondary inline-flex h-9 shrink-0 items-center gap-1 px-2.5 text-xs"
        >
          <ListChecks className="h-4 w-4" />
          Picking List
        </button>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={busy}
          className="btn-primary inline-flex h-9 shrink-0 items-center gap-1 px-2.5 text-xs disabled:opacity-60"
        >
          {syncing || bootstrapping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sync Data
        </button>
        <button
          type="button"
          onClick={() => void syncPictures()}
          disabled={busy}
          className="btn-secondary inline-flex h-9 shrink-0 items-center gap-1 px-2.5 text-xs disabled:opacity-60"
        >
          {imageSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          Sync pictures
        </button>
      </div>

      <p className="text-[11px] text-[var(--muted)]">
        {imageSyncing || imageSyncMessage
          ? imageSyncMessage
          : busy
            ? bootstrapping || syncing
              ? "Syncing Product Images from Google Sheets…"
              : "Loading catalog…"
            : lastSyncedAt
              ? `Last synced: ${formatPortalTimestamp(lastSyncedAt)}`
              : "Not synced yet — run setup_ops_picking.sql, then Sync Data."}
        {!imageSyncing && pendingPictures != null
          ? pendingPictures > 0
            ? ` · ${pendingPictures.toLocaleString()} pictures waiting to copy${
                storedPictures
                  ? ` · ${storedPictures.toLocaleString()} already in Supabase`
                  : ""
              }`
            : storedPictures
              ? ` · ${storedPictures.toLocaleString()} pictures in Supabase`
              : " · All pictures are in Supabase"
          : ""}
        {warning ? ` ${warning}` : ""}
      </p>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--card-border)] bg-white px-3 py-2">
          <span className="text-xs font-medium text-portal-900">
            {selectedCount} SKU{selectedCount === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            className="btn-primary h-8 px-3 text-[11px] disabled:opacity-60"
            disabled={docBusy}
            onClick={() => void downloadSelection("awb")}
          >
            Download Picking List
          </button>
          <button
            type="button"
            className="btn-primary h-8 px-3 text-[11px] disabled:opacity-60"
            disabled={docBusy}
            onClick={() => void downloadSelection("grn")}
          >
            Download GRN
          </button>
          <button
            type="button"
            className="btn-secondary h-8 px-3 text-[11px]"
            onClick={() => setSelected({})}
          >
            Clear
          </button>
        </div>
      ) : null}

      {docError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {docError}
        </div>
      ) : null}

      <section className="card overflow-hidden p-0">
        {busy && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-portal-500" />
            <p className="text-sm text-gray-600">Loading products…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">
            {search.trim()
              ? "No products match those SKUs or name."
              : "No catalog yet. Sync Data, add a product, or bulk upload pictures."}
          </div>
        ) : (
          <div>
            <table className="w-full table-fixed divide-y divide-gray-100 text-sm">
              <colgroup>
                <col className="w-10" />
                <col className="w-[88px]" />
                <col />
                <col className="w-[30%]" />
                <col className="w-[92px]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={togglePage}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th className="px-2 py-3 text-center">Picture</th>
                  <th className="px-3 py-3 text-left">Product name</th>
                  <th className="px-3 py-3 text-center">SKU</th>
                  <th className="px-2 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {items.map((row) => (
                  <tr key={row.sku} className="hover:bg-gray-50">
                    <td className="px-2 py-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[row.sku])}
                        onChange={() => toggleRow(row)}
                        aria-label={`Select ${row.sku}`}
                      />
                    </td>
                    <td className="px-2 py-2 text-center align-middle">
                      {row.image_url ? (
                        <ProductThumb
                          src={row.image_url}
                          alt={row.product_name}
                          className="mx-auto h-16 w-16 rounded-md border border-gray-200 object-contain bg-white"
                          onClick={() => setPreview(row)}
                        />
                      ) : (
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400">
                          No picture
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle font-medium text-gray-900 break-words">
                      {row.product_name}
                    </td>
                    <td className="px-3 py-3 align-middle text-right font-mono text-xs text-gray-700 break-all">
                      {row.sku}
                    </td>
                    <td className="px-2 py-3 text-right align-middle">
                      <PickingEditButton onClick={() => setEditing(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ListPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={total}
        itemLabel="products"
        onPageChange={setCurrentPage}
      />

      <PickingAddProductDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => void load(currentPage, search)}
      />
      <PickingAddProductDialog
        open={Boolean(editing)}
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load(currentPage, search);
        }}
      />
      <PickingBulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onComplete={() => {
          setCurrentPage(1);
          void load(1, search);
        }}
      />
      <PickingDocumentDialog
        open={grnDocOpen}
        onClose={() => setGrnDocOpen(false)}
        docType="grn"
        lookupProducts={lookupProducts}
        onDownload={(payload) => downloadDocument("grn", payload)}
      />
      <PickingDocumentDialog
        open={pickingDocOpen}
        onClose={() => setPickingDocOpen(false)}
        docType="awb"
        lookupProducts={lookupProducts}
        onDownload={(payload) => downloadDocument("awb", payload)}
      />
      <PickingPictureLightbox product={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
