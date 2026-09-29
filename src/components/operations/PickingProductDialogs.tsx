"use client";

import { useEffect, useRef, useState } from "react";
import { Download, History, Loader2, Pencil, Upload, X } from "lucide-react";
import type { PickingProduct } from "@/lib/operations/picking";
import {
  parseSkuDocumentText,
} from "@/lib/operations/pickingParse";
import { pickingDocumentLabel } from "@/lib/operations/pickingSheet";
import { pickingDocumentImageSrc } from "@/lib/operations/pickingImageUrl";
import { formatPortalTimestamp } from "@/lib/portalTimezone";

const dialogShell =
  "fixed inset-0 z-[100] m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 shadow-none sm:items-center sm:p-4 backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm";

const fieldClass =
  "mt-1 h-10 w-full rounded-xl border border-portal-200 bg-white px-3 text-sm text-portal-900 outline-none focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20";

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
      <div className="w-full max-w-md rounded-t-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-2xl sm:p-5 max-sm:max-h-[92dvh] max-sm:overflow-y-auto">
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
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt=""
                className="h-28 w-28 rounded-md border border-gray-200 object-contain bg-white"
              />
              <button
                type="button"
                aria-label="Remove picture"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow hover:bg-red-50 hover:text-red-600"
                onClick={() => {
                  if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
                  setFile(null);
                  setPreview(editing ? product?.image_url ?? null : null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
              {saving ? "Savingâ€¦" : editing ? "Save changes" : "Save product"}
            </button>
          </div>
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
  initialSkus,
}: {
  open: boolean;
  onClose: () => void;
  docType: "grn" | "awb";
  lookupProducts: (skus: string[]) => Promise<PickingProduct[]>;
  initialSkus?: PickingProduct[] | null;
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
  const [manualQty, setManualQty] = useState("");
  const [manualGoodQty, setManualGoodQty] = useState("");
  const [manualBadQty, setManualBadQty] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = docType === "grn" ? "GRN Document" : "Picking List";
  const downloadLabel = docType === "grn" ? "Download GRN" : "Download Picking List";

  const resetState = () => {
    setStep("build");
    setDraftLines([]);
    setPreviewLines([]);
    setFileText("");
    setManualSku("");
    setManualQty("");
    setManualGoodQty("");
    setManualBadQty("");
    setComments("");
    setShowComments(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      resetState();
      if (initialSkus && initialSkus.length > 0) {
        setDraftLines(
          initialSkus.map((product) => ({
            id: `${product.sku}-${Math.random()}`,
            sku: product.sku,
            quantity: 0,
            good_qty: null,
            bad_qty: null,
          })),
        );
      }
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open, initialSkus]);

  const requestClose = () => {
    resetState();
    dialogRef.current?.close();
    onClose();
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
    setManualQty("");
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
        setFileText("");
      }
    }
    if (lines.length === 0) {
      setError("Add at least one SKU before previewing the document.");
      return;
    }
    if (lines.some((line) => !line.quantity || line.quantity <= 0)) {
      setError("Enter a quantity greater than 0 for every SKU in the list.");
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
            product_name: product?.product_name?.trim() || line.sku,
            image_url: pickingDocumentImageSrc(product?.image_url ?? null),
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
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-2xl sm:p-5">
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
            {initialSkus && initialSkus.length > 0 && draftLines.length > 0 ? (
              <p className="mb-3 rounded-lg bg-portal-50 px-3 py-2 text-xs text-portal-800">
                Enter a quantity for each selected SKU below, then preview the document.
              </p>
            ) : null}
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
                  placeholder={docType === "grn" ? "Total qty" : "Qty"}
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
                            className="input h-8 w-20 text-right"
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={line.quantity > 0 ? line.quantity : ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const quantity = raw === "" ? 0 : Number(raw);
                              setDraftLines((prev) =>
                                prev.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        quantity:
                                          raw === ""
                                            ? 0
                                            : Number.isFinite(quantity) && quantity > 0
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
              {busy ? "Loading previewâ€¦" : "Preview document"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary h-9 px-3 text-xs disabled:opacity-60"
              disabled={busy}
              onClick={() => void downloadDocument()}
            >
              {busy ? "Creatingâ€¦" : downloadLabel}
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
      className="btn-secondary inline-flex h-8 w-8 items-center justify-center px-0 text-[11px]"
      onClick={onClick}
      title="Edit product"
      aria-label="Edit product"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

type PickingHistoryLog = {
  id: string;
  action: string;
  summary: string;
  changed_by: string | null;
  changed_at: string;
};

export function PickingProductHistoryDialog({
  open,
  sku,
  productName,
  onClose,
}: {
  open: boolean;
  sku: string | null;
  productName?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [logs, setLogs] = useState<PickingHistoryLog[]>([]);
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
    if (!open || !sku) {
      setLogs([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/operations/picking/logs?sku=${encodeURIComponent(sku)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load history");
        if (!cancelled) setLogs((json.logs as PickingHistoryLog[]) ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load history");
          setLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sku]);

  if (!open || !sku) return null;

  return (
    <dialog ref={dialogRef} onClose={onClose} className={dialogShell}>
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Change history</h2>
            <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{productName ?? sku}</p>
            <p className="font-mono text-xs text-[var(--muted)]">{sku}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4 text-[var(--muted)]" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-red-600">{error}</p>
        ) : logs.length === 0 ? (
          <p className="py-4 text-sm text-[var(--muted)]">No changes recorded for this SKU yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-[var(--card-border)]">
            {logs.map((entry) => (
              <li key={entry.id} className="px-3 py-2.5 text-xs">
                <p className="font-medium text-portal-900">{entry.summary}</p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                  {formatPortalTimestamp(entry.changed_at)}
                  {entry.changed_by ? ` · ${entry.changed_by}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
