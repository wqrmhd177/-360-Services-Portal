"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

function parseCsv(text: string): Array<{ sku: string; fulfilment_route: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const skuIdx = header.findIndex((h) => h === "sku");
  const routeIdx = header.findIndex(
    (h) => h === "fulfilment route" || h === "fulfilment_route" || h === "route",
  );

  const startRow = skuIdx >= 0 && routeIdx >= 0 ? 1 : 0;
  const colSku = skuIdx >= 0 ? skuIdx : 0;
  const colRoute = routeIdx >= 0 ? routeIdx : 1;

  return lines.slice(startRow).flatMap((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const sku = cols[colSku]?.trim();
    const fulfilment_route = cols[colRoute]?.trim();
    if (!sku || !fulfilment_route) return [];
    return [{ sku, fulfilment_route }];
  });
}

export function InventoryBulkUploadDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    updated: number;
    skipped: number;
    errors: Array<{ sku: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  const requestClose = () => {
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
    dialogRef.current?.close();
    onClose();
  };

  const downloadTemplate = () => {
    const csv = "SKU,Fulfilment Route\nGFT-1234,Local KSA\nGFT-5678,Local UAE\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "fulfilment-routes-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const routes = parseCsv(text);
      if (routes.length === 0) {
        throw new Error("No valid rows found. CSV must include SKU and Fulfilment Route columns.");
      }

      const res = await fetch("/api/operations/inventory/fulfilment-routes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");

      setResult({
        updated: json.updated ?? 0,
        skipped: json.skipped ?? 0,
        errors: json.errors ?? [],
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="bulk-upload-title"
      onClose={requestClose}
      className={cn(
        "portal-status-dialog",
        "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center",
        "border-0 bg-transparent p-0 shadow-none sm:p-6",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="bulk-upload-title" className="text-base font-semibold text-gray-900">
              Bulk Upload Fulfilment Routes
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Upload a CSV with SKU and Fulfilment Route columns.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline"
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </button>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center hover:border-teal-300">
            <Upload className="mb-2 h-8 w-8 text-gray-300" />
            <span className="text-sm font-medium text-gray-700">
              {uploading ? "Uploading…" : "Choose CSV file"}
            </span>
            <span className="mt-1 text-xs text-gray-500">SKU, Fulfilment Route</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </label>

          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing upload…
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {result ? (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">
                Updated {result.updated} route{result.updated === 1 ? "" : "s"}
                {result.skipped > 0 ? ` · Skipped ${result.skipped}` : ""}
              </p>
              {result.errors.length > 0 ? (
                <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-red-600">
                  {result.errors.map((e, i) => (
                    <li key={`${e.sku}-${i}`}>
                      {e.sku || "(blank)"}: {e.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
