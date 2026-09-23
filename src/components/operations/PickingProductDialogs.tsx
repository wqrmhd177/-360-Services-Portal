"use client";

import { useEffect, useRef, useState } from "react";
import { Download, History, Loader2, Pencil, Upload, X } from "lucide-react";
import type { PickingProduct } from "@/lib/operations/picking";
import type { PickingProductLog } from "@/lib/operations/pickingAudit";
import {
  pickingSkuFromFileName,
  parseSkuDocumentText,
} from "@/lib/operations/pickingParse";
import { pickingDocumentLabel } from "@/lib/operations/pickingSheet";

const dialogShell =
  "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-0 shadow-none sm:p-6 backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm";

const fieldClass =
  "mt-1 h-10 w-full rounded-xl border border-portal-200 bg-white px-3 text-sm text-portal-900 outline-none focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20";

type BulkPictureRow = {
  id: string;
  file: File;
  preview: string;
  sku: string;
  name: string;
};

export function PickingAddProductDialog({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  product?: PickingProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(product);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setSku(product?.sku ?? "");
      setName(product?.product_name ?? "");
      setFile(null);
      setPreview(product?.image_url ?? null);
      setError(null);
      if (fileRef.current) fileRef.current.value = "";
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open, product]);

  const requestClose = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setSku("");
    setName("");
    setFile(null);
    setPreview(null);
    setError(null);
    dialogRef.current?.close();
    onClose();
  };

  const save = async () => {
    if (!sku.trim() || !name.trim()) {
      setError("SKU and product name are required.");
      return;
    }
    if (!editing && !file) {
      setError("Add a product picture with the SKU and name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("sku", sku.trim());
      form.append("product_name", name.trim());
      if (product?.sku) form.append("original_sku", product.sku);
      if (file) form.append("image", file);
      const res = await fetch("/api/operations/picking/product", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save product");
      onSaved();
      requestClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} onClose={requestClose} className={dialogShell}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">
            {editing ? "Edit product" : "Add product"}
          </h2>
          <button type="button" onClick={requestClose} aria-label="Close">
            <X className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[var(--muted)]">
            SKU
            <input
              type="text"
              autoComplete="off"
              placeholder="Enter SKU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Product name
            <input
              type="text"
              autoComplete="off"
              placeholder="Enter product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Product picture
            <input
              ref={fileRef}
              className="mt-1 block w-full text-sm"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
                setFile(next);
                setPreview(next ? URL.createObjectURL(next) : product?.image_url ?? null);
              }}
            />
          </label>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-28 w-28 rounded-md border border-gray-200 object-contain bg-white"
            />
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={requestClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary h-9 px-3 text-xs disabled:opacity-60"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Save product"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function PickingBulkUploadDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<BulkPictureRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  const clearPreviews = (items: BulkPictureRow[]) => {
    for (const row of items) URL.revokeObjectURL(row.preview);
  };

  const requestClose = () => {
    clearPreviews(rows);
    setRows([]);
    setError(null);
    setResult(null);
    dialogRef.current?.close();
    onClose();
  };

  const addFiles = (files: FileList | File[]) => {
    const next: BulkPictureRow[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        sku: pickingSkuFromFileName(file.name),
        name: "",
      });
    }
    if (next.length === 0) {
      setError("Choose JPG, PNG, GIF, or WebP pictures. File name becomes the SKU.");
      return;
    }
    setError(null);
    setResult(null);
    setRows((prev) => [...prev, ...next]);
  };

  const handleUpload = async () => {
    if (rows.length === 0) {
      setError("Drop or choose product pictures first. Name each file as the SKU.");
      return;
    }
    if (rows.some((row) => !row.sku.trim())) {
      setError("Every picture needs a SKU.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      for (const row of rows) {
        form.append("images", row.file);
        form.append("skus", row.sku.trim());
        form.append("names", row.name.trim() || row.sku.trim());
      }
      const res = await fetch("/api/operations/picking/bulk", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setResult(
        `Saved ${Number(json.rowCount ?? 0).toLocaleString()} products` +
          (json.withImages ? ` (${json.withImages} with pictures)` : ""),
      );
      clearPreviews(rows);
      setRows([]);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} onClose={requestClose} className={dialogShell}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Bulk upload pictures</h2>
          <button type="button" onClick={requestClose} aria-label="Close">
            <X className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Choose pictures only. The file name is the SKU, then fill the product name if you want.
          Example: <code>KPA-N-TY-ZAM.jpg</code>.
        </p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-portal-200 bg-portal-50/60 px-4 py-8 text-center hover:border-portal-400">
          <Upload className="mb-2 h-6 w-6 text-portal-700" />
          <span className="text-sm font-medium text-portal-900">
            Drop pictures here or click to choose
          </span>
          <span className="mt-1 text-xs text-[var(--muted)]">
            JPG, PNG, GIF, or WebP — one picture per SKU
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--card-border)]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Picture</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Product name</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.preview}
                        alt=""
                        className="h-12 w-12 rounded-md object-contain"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.sku}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((item) =>
                              item.id === row.id ? { ...item, sku: e.target.value } : item,
                            ),
                          )
                        }
                        className="input h-8 w-40"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="Optional"
                        value={row.name}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((item) =>
                              item.id === row.id ? { ...item, name: e.target.value } : item,
                            ),
                          )
                        }
                        className="input h-8 w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => {
                          URL.revokeObjectURL(row.preview);
                          setRows((prev) => prev.filter((item) => item.id !== row.id));
                        }}
                      >
                        <X className="h-4 w-4 text-[var(--muted)]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {result ? <p className="mt-3 text-sm text-teal-700">{result}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={requestClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-60"
            disabled={uploading}
            onClick={() => void handleUpload()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload pictures"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

type DocumentDraftLine = {
  id: string;
  sku: string;
  quantity: number;
  good_qty: number | null;
  bad_qty: number | null;
};

type DocumentPreviewLine = {
  sku: string;
  product_name: string;
  image_url: string | null;
  quantity: number;
  good_qty: number | null;
  bad_qty: number | null;
};

function mergeDraftLines(
  current: DocumentDraftLine[],
  incoming: Array<{
    sku: string;
    quantity: number;
    good_qty?: number | null;
    bad_qty?: number | null;
  }>,
): DocumentDraftLine[] {
  const next = [...current];
  for (const row of incoming) {
    const idx = next.findIndex((line) => line.sku.toLowerCase() === row.sku.toLowerCase());
    if (idx < 0) {
      next.push({
        id: `${row.sku}-${Math.random()}`,
        sku: row.sku,
        quantity: row.quantity,
        good_qty: row.good_qty ?? null,
        bad_qty: row.bad_qty ?? null,
      });
      continue;
    }
    next[idx] = {
      ...next[idx],
      quantity: next[idx].quantity + row.quantity,
      good_qty: row.good_qty ?? next[idx].good_qty,
      bad_qty: row.bad_qty ?? next[idx].bad_qty,
    };
  }
  return next;
}

function documentTemplateCsv(docType: "grn" | "awb"): string {
  if (docType === "grn") {
    return "SKU,Total Qty,Good Qty,Bad Qty\nKPA-N-TY-ZAM,10,,\n";
  }
  return "SKU,Qty\nKPA-N-TY-ZAM,5\n";
}

function documentTemplateName(docType: "grn" | "awb"): string {
  return docType === "grn" ? "grn-document-template.csv" : "picking-list-template.csv";
}

export function PickingDocumentDialog({
  open,
  onClose,
  docType,
  lookupProducts,
  onDownload,
}: {
  open: boolean;
  onClose: () => void;
  docType: "grn" | "awb";
  lookupProducts: (skus: string[]) => Promise<PickingProduct[]>;
  onDownload: (payload: {
    lines: Array<{
      sku: string;
      quantity: number;
      good_qty?: number | null;
      bad_qty?: number | null;
    }>;
    comments: string;
  }) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"build" | "preview">("build");
  const [draftLines, setDraftLines] = useState<DocumentDraftLine[]>([]);
  const [previewLines, setPreviewLines] = useState<DocumentPreviewLine[]>([]);
  const [fileText, setFileText] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualGoodQty, setManualGoodQty] = useState("");
  const [manualBadQty, setManualBadQty] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = docType === "grn" ? "GRN Document" : "Picking List";
  const downloadLabel = docType === "grn" ? "Download GRN" : "Download Picking List";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  const resetState = () => {
    setStep("build");
    setDraftLines([]);
    setPreviewLines([]);
    setFileText("");
    setManualSku("");
    setManualQty("1");
    setManualGoodQty("");
    setManualBadQty("");
    setComments("");
    setShowComments(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const requestClose = () => {
    resetState();
    dialogRef.current?.close();
    onClose();
  };

  const importText = (text: string) => {
    const parsed = parseSkuDocumentText(text);
    if (parsed.length === 0) {
      setError("Add SKUs manually or upload a file with a SKU column.");
      return;
    }
    setDraftLines((prev) =>
      mergeDraftLines(
        prev,
        parsed.map((row) => ({
          sku: row.sku,
          quantity: row.quantity,
          good_qty: row.good_qty,
          bad_qty: row.bad_qty,
        })),
      ),
    );
    setError(null);
  };

  const addManualLine = () => {
    const sku = manualSku.trim();
    const quantity = Number(manualQty);
    const goodQty = manualGoodQty.trim() ? Number(manualGoodQty) : null;
    const badQty = manualBadQty.trim() ? Number(manualBadQty) : null;
    if (!sku || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a SKU and a quantity greater than 0.");
      return;
    }
    if (
      (goodQty != null && (!Number.isFinite(goodQty) || goodQty < 0)) ||
      (badQty != null && (!Number.isFinite(badQty) || badQty < 0))
    ) {
      setError("Good Qty and Bad Qty must be zero or greater.");
      return;
    }
    setDraftLines((prev) =>
      mergeDraftLines(prev, [
        {
          sku,
          quantity,
          good_qty: goodQty,
          bad_qty: badQty,
        },
      ]),
    );
    setManualSku("");
    setManualQty("1");
    setManualGoodQty("");
    setManualBadQty("");
    setError(null);
  };

  const buildPreview = async () => {
    let lines = draftLines;
    if (fileText.trim()) {
      const parsed = parseSkuDocumentText(fileText);
      if (parsed.length > 0) {
        lines = mergeDraftLines(
          draftLines,
          parsed.map((row) => ({
            sku: row.sku,
            quantity: row.quantity,
            good_qty: row.good_qty,
            bad_qty: row.bad_qty,
          })),
        );
        setDraftLines(lines);
      }
    }
    if (lines.length === 0) {
      setError("Add at least one SKU before previewing the document.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const found = await lookupProducts(lines.map((line) => line.sku));
      const bySku = new Map(found.map((row) => [row.sku.toLowerCase(), row]));
      setPreviewLines(
        lines.map((line) => {
          const product = bySku.get(line.sku.toLowerCase());
          return {
            sku: line.sku,
            product_name: product?.product_name?.trim() || "Not Available",
            image_url: product?.image_url ?? null,
            quantity: line.quantity,
            good_qty: line.good_qty,
            bad_qty: line.bad_qty,
          };
        }),
      );
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load preview");
    } finally {
      setBusy(false);
    }
  };

  const downloadDocument = async () => {
    if (previewLines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onDownload({
        lines: previewLines.map((line) => ({
          sku: line.sku,
          quantity: line.quantity,
          good_qty: line.good_qty,
          bad_qty: line.bad_qty,
        })),
        comments: showComments ? comments : "",
      });
      requestClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create document");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} onClose={requestClose} className={dialogShell}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {step === "build"
                ? "Add a few SKUs manually or upload a SKU file, then preview before download."
                : "Review the document lines, then download or go back to edit."}
            </p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close">
            <X className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>

        {step === "build" ? (
          <>
            <div className={`grid gap-3 ${docType === "grn" ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-3"}`}>
              <label className="block text-xs font-medium text-[var(--muted)]">
                SKU
                <input
                  type="text"
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  className={fieldClass}
                  placeholder="Enter SKU"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--muted)]">
                {docType === "grn" ? "Total Qty" : "Qty"}
                <input
                  type="number"
                  min={1}
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className={fieldClass}
                />
              </label>
              {docType === "grn" ? (
                <>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Good Qty
                    <input
                      type="number"
                      min={0}
                      value={manualGoodQty}
                      onChange={(e) => setManualGoodQty(e.target.value)}
                      className={fieldClass}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Bad Qty
                    <input
                      type="number"
                      min={0}
                      value={manualBadQty}
                      onChange={(e) => setManualBadQty(e.target.value)}
                      className={fieldClass}
                      placeholder="Optional"
                    />
                  </label>
                </>
              ) : null}
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary h-10 w-full px-3 text-xs"
                  onClick={addManualLine}
                >
                  Add SKU
                </button>
              </div>
            </div>

            <textarea
              className="input mt-4 min-h-[120px]"
              placeholder={
                docType === "grn"
                  ? "SKU,Total Qty,Good Qty,Bad Qty\nKPA-N-TY-ZAM,10,,\n"
                  : "SKU,Qty\nKPA-N-TY-ZAM,5\n"
              }
              value={fileText}
              onChange={(e) => setFileText(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="btn-secondary inline-flex h-9 cursor-pointer items-center px-3 text-xs">
                Upload SKU file
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const text = await file.text();
                    setFileText(text);
                    importText(text);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-secondary inline-flex h-9 items-center gap-2 px-3 text-xs"
                onClick={() => {
                  const csv = documentTemplateCsv(docType);
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = documentTemplateName(docType);
                  link.click();
                  URL.revokeObjectURL(link.href);
                }}
              >
                <Download className="h-4 w-4" />
                Template
              </button>
              <span className="text-[11px] text-[var(--muted)]">
                {draftLines.length} SKU{draftLines.length === 1 ? "" : "s"} added
              </span>
            </div>

            {draftLines.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--card-border)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">{docType === "grn" ? "Total Qty" : "Qty"}</th>
                      {docType === "grn" ? (
                        <>
                          <th className="px-3 py-2 text-right">Good Qty</th>
                          <th className="px-3 py-2 text-right">Bad Qty</th>
                        </>
                      ) : null}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {draftLines.map((line) => (
                      <tr key={line.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono">{line.sku}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="input h-8 w-16 text-right"
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => {
                              const quantity = Number(e.target.value);
                              setDraftLines((prev) =>
                                prev.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        quantity:
                                          Number.isFinite(quantity) && quantity > 0
                                            ? quantity
                                            : row.quantity,
                                      }
                                    : row,
                                ),
                              );
                            }}
                          />
                        </td>
                        {docType === "grn" ? (
                          <>
                            <td className="px-3 py-2 text-right">
                              <input
                                className="input h-8 w-16 text-right"
                                type="number"
                                min={0}
                                value={line.good_qty ?? ""}
                                onChange={(e) => {
                                  const goodQty = e.target.value.trim()
                                    ? Number(e.target.value)
                                    : null;
                                  setDraftLines((prev) =>
                                    prev.map((row) =>
                                      row.id === line.id ? { ...row, good_qty: goodQty } : row,
                                    ),
                                  );
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                className="input h-8 w-16 text-right"
                                type="number"
                                min={0}
                                value={line.bad_qty ?? ""}
                                onChange={(e) => {
                                  const badQty = e.target.value.trim()
                                    ? Number(e.target.value)
                                    : null;
                                  setDraftLines((prev) =>
                                    prev.map((row) =>
                                      row.id === line.id ? { ...row, bad_qty: badQty } : row,
                                    ),
                                  );
                                }}
                              />
                            </td>
                          </>
                        ) : null}
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            aria-label="Remove"
                            onClick={() =>
                              setDraftLines((prev) => prev.filter((row) => row.id !== line.id))
                            }
                          >
                            <X className="h-4 w-4 text-[var(--muted)]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--card-border)]">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Picture</th>
                  <th className="px-3 py-2 text-left">Product Name with SKU</th>
                  <th className="px-3 py-2 text-right">SKU</th>
                  <th className="px-3 py-2 text-right">{docType === "grn" ? "Total Qty" : "Qty"}</th>
                  {docType === "grn" ? (
                    <>
                      <th className="px-3 py-2 text-right">Good Qty</th>
                      <th className="px-3 py-2 text-right">Bad Qty</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {previewLines.map((line) => (
                  <tr key={line.sku} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {line.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={line.image_url}
                          alt=""
                          className="mx-auto h-14 w-14 rounded-md border border-gray-200 object-contain"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400">
                          Not Available
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {pickingDocumentLabel(line.product_name, line.sku)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{line.sku}</td>
                    <td className="px-3 py-2 text-right">{line.quantity}</td>
                    {docType === "grn" ? (
                      <>
                        <td className="px-3 py-2 text-right">{line.good_qty ?? ""}</td>
                        <td className="px-3 py-2 text-right">{line.bad_qty ?? ""}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showComments}
            onChange={(e) => setShowComments(e.target.checked)}
          />
          Show comments on the document
        </label>
        {showComments ? (
          <textarea
            className="input mt-2 min-h-[80px]"
            placeholder="Comments to print on the document"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          {step === "preview" ? (
            <button
              type="button"
              className="btn-secondary h-9 px-3 text-xs"
              disabled={busy}
              onClick={() => setStep("build")}
            >
              Back
            </button>
          ) : (
            <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={requestClose}>
              Cancel
            </button>
          )}
          {step === "build" ? (
            <button
              type="button"
              className="btn-primary h-9 px-3 text-xs disabled:opacity-60"
              disabled={busy}
              onClick={() => void buildPreview()}
            >
              {busy ? "Loading preview…" : "Preview document"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary h-9 px-3 text-xs disabled:opacity-60"
              disabled={busy}
              onClick={() => void downloadDocument()}
            >
              {busy ? "Creating…" : downloadLabel}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function PickingPictureLightbox({
  product,
  onClose,
}: {
  product: PickingProduct | null;
  onClose: () => void;
}) {
  if (!product) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--card-border)] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-portal-900">{product.product_name}</h2>
            <p className="mt-0.5 font-mono text-sm text-[var(--muted)]">{product.sku}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.product_name}
            className="max-h-[70vh] w-full rounded-lg bg-gray-50 object-contain"
          />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-[var(--muted)]">
            No picture
          </div>
        )}
      </div>
    </div>
  );
}

export function PickingEditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn-secondary inline-flex h-8 items-center gap-1 px-2 text-[11px]"
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </button>
  );
}

function formatPickingLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PickingHistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn-secondary inline-flex h-8 w-8 items-center justify-center px-0 text-[11px]"
      onClick={onClick}
      title="View change history"
      aria-label="View change history"
    >
      <History className="h-3.5 w-3.5" />
    </button>
  );
}

export function PickingProductHistoryDialog({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: PickingProduct | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [logs, setLogs] = useState<PickingProductLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !product?.sku) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLogs([]);
    fetch(`/api/operations/picking/logs?sku=${encodeURIComponent(product.sku)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load history");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, product?.sku]);

  const requestClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  return (
    <dialog ref={dialogRef} className={dialogShell} onCancel={requestClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-portal-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-portal-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-portal-900">Change history</h2>
            {product && (
              <p className="mt-1 text-sm text-portal-600">
                {product.product_name} · <span className="font-mono">{product.sku}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1 text-portal-500 hover:bg-portal-50 hover:text-portal-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-portal-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history…
            </div>
          ) : error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-portal-500">No changes recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-portal-100 bg-portal-50/60 px-3 py-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-portal-900">{log.summary}</p>
                    <time className="shrink-0 text-[11px] text-portal-500">
                      {formatPickingLogTime(log.changed_at)}
                    </time>
                  </div>
                  {(log.old_value || log.new_value) && (
                    <div className="mt-2 space-y-1 text-xs text-portal-700">
                      {log.old_value && (
                        <p>
                          <span className="font-medium text-portal-500">Before:</span> {log.old_value}
                        </p>
                      )}
                      {log.new_value && (
                        <p>
                          <span className="font-medium text-portal-500">After:</span> {log.new_value}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-portal-500">
                    {log.changed_by ? `Updated by ${log.changed_by}` : "Updated by system"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
