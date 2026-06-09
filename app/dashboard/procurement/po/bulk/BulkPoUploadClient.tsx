"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { recalcProductLine } from "@/components/PoProductsTable";
import {
  bulkPoCsvTemplate,
  groupBulkPoRowsByMode,
  parseBulkPoCsv,
  type BulkPoCsvRow,
  type BulkPoGroup,
  type BulkPoGroupingMode,
} from "@/lib/poValidation";
import type { PoProduct } from "@/types/workflows";

type CreatedPo = { po_id: string; po_number?: string | null; lineCount: number };

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const GROUPING_OPTIONS: { value: BulkPoGroupingMode; label: string; hint: string }[] = [
  {
    value: "grouped",
    label: "Group by supplier + delivery",
    hint: "Same supplier, location, and delivery partner → one PO with multiple lines.",
  },
  {
    value: "split",
    label: "One PO per row",
    hint: "Each CSV row becomes its own PO with its own supplier and delivery details.",
  },
  {
    value: "single",
    label: "Single PO (all lines)",
    hint: "All rows combined into one PO. Edit header fields below before creating.",
  },
];

export default function BulkPoUploadPage() {
  const [csvRows, setCsvRows] = useState<BulkPoCsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [groupingMode, setGroupingMode] = useState<BulkPoGroupingMode>("grouped");
  const [groups, setGroups] = useState<BulkPoGroup[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: CreatedPo[];
    failed: Array<{ groupKey: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    if (csvRows.length === 0 || parseErrors.length > 0) {
      setGroups([]);
      return;
    }
    setGroups(groupBulkPoRowsByMode(csvRows, groupingMode));
  }, [csvRows, groupingMode, parseErrors.length]);

  function downloadTemplate() {
    const blob = new Blob([bulkPoCsvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_po_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) {
      setCsvRows([]);
      setFileName(null);
      setParseErrors([]);
      return;
    }

    const text = await file.text();
    const { rows, errors } = parseBulkPoCsv(text);
    setCsvRows(rows);
    setFileName(file.name);
    setParseErrors(errors);
  }

  function updateGroupField(
    groupIndex: number,
    field: keyof BulkPoGroup,
    value: string
  ) {
    setGroups((prev) => {
      const next = [...prev];
      next[groupIndex] = { ...next[groupIndex], [field]: value };
      return next;
    });
  }

  function updateProductField(
    groupIndex: number,
    productIndex: number,
    field: keyof PoProduct,
    raw: string
  ) {
    setGroups((prev) => {
      const next = [...prev];
      const products = [...next[groupIndex].products];
      const numeric = new Set([
        "quantity",
        "productCostPerUnit",
        "freightCostPerUnit",
        "rate",
        "amount",
      ]);
      const value = numeric.has(field) ? Number(raw) || 0 : raw;
      products[productIndex] = recalcProductLine(products[productIndex], field, value);
      next[groupIndex] = { ...next[groupIndex], products };
      return next;
    });
  }

  async function handleSubmit() {
    if (groups.length === 0 || parseErrors.length > 0) return;

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/procurement/po/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Bulk PO creation failed.");
        return;
      }
      setResult(data);
    } catch {
      alert("Bulk PO creation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/procurement/po" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Purchase Orders
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
          Bulk Create Purchase Orders
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV, choose how rows become POs, review and edit all fields, then create.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={downloadTemplate} className="btn-secondary">
            Download CSV Template
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span>Choose CSV file</span>
            <input
              id="bulk-po-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {fileName && <span className="text-sm text-gray-600">{fileName}</span>}
        </div>

        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">Fix these issues before continuing:</p>
            <ul className="mt-1 list-disc pl-5">
              {parseErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {csvRows.length > 0 && parseErrors.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">PO creation mode</p>
            <div className="grid gap-2 md:grid-cols-3">
              {GROUPING_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-lg border p-3 text-sm ${
                    groupingMode === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="grouping_mode"
                    value={opt.value}
                    checked={groupingMode === opt.value}
                    onChange={() => setGroupingMode(opt.value)}
                    className="mr-2"
                  />
                  <span className="font-medium text-gray-900">{opt.label}</span>
                  <p className="mt-1 text-xs text-gray-600">{opt.hint}</p>
                </label>
              ))}
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Review &amp; edit — {groups.length} PO{groups.length !== 1 ? "s" : ""} will be created
            </h3>

            {groups.map((group, gi) => (
              <div
                key={group.groupKey}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  PO {gi + 1} of {groups.length}
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Supplier</label>
                    <input className={inputClass} value={group.supplier_name} onChange={(e) => updateGroupField(gi, "supplier_name", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Location</label>
                    <input className={inputClass} value={group.supplier_location} onChange={(e) => updateGroupField(gi, "supplier_location", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Delivery Partner</label>
                    <input className={inputClass} value={group.delivery_partner} onChange={(e) => updateGroupField(gi, "delivery_partner", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Tracking ID</label>
                    <input className={inputClass} value={group.delivery_partner_tracking_id} onChange={(e) => updateGroupField(gi, "delivery_partner_tracking_id", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">PO Type</label>
                    <select className={inputClass} value={group.po_type} onChange={(e) => updateGroupField(gi, "po_type", e.target.value)}>
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs text-gray-600">Remarks</label>
                    <input className={inputClass} value={group.remarks ?? ""} onChange={(e) => updateGroupField(gi, "remarks", e.target.value)} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="border-b border-gray-300 text-gray-600">
                      <tr>
                        <th className="py-1 pr-2 text-left font-medium">Product</th>
                        <th className="py-1 pr-2 text-left font-medium">SKU</th>
                        <th className="py-1 pr-2 text-left font-medium">Qty</th>
                        <th className="py-1 pr-2 text-left font-medium">Product Cost</th>
                        <th className="py-1 pr-2 text-left font-medium">Freight Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.products.map((p, pi) => (
                        <tr key={pi} className="border-b border-gray-200 last:border-0">
                          <td className="py-1 pr-2">
                            <input className={inputClass} value={p.productName} onChange={(e) => updateProductField(gi, pi, "productName", e.target.value)} />
                          </td>
                          <td className="py-1 pr-2">
                            <input className={inputClass} value={p.skuCode ?? ""} onChange={(e) => updateProductField(gi, pi, "skuCode", e.target.value)} />
                          </td>
                          <td className="py-1 pr-2">
                            <input type="number" min={1} className={inputClass} value={p.quantity} onChange={(e) => updateProductField(gi, pi, "quantity", e.target.value)} />
                          </td>
                          <td className="py-1 pr-2">
                            <input type="number" min={0} step="0.01" className={inputClass} value={p.productCostPerUnit ?? ""} onChange={(e) => updateProductField(gi, pi, "productCostPerUnit", e.target.value)} />
                          </td>
                          <td className="py-1 pr-2">
                            <input type="number" min={0} step="0.01" className={inputClass} value={p.freightCostPerUnit ?? ""} onChange={(e) => updateProductField(gi, pi, "freightCostPerUnit", e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? "Creating POs…" : `Create ${groups.length} PO${groups.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Results</h3>
          {result.created.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <p className="font-medium">Created {result.created.length} PO(s):</p>
              <ul className="mt-1 list-disc pl-5">
                {result.created.map((po) => (
                  <li key={po.po_id}>
                    <Link href={`/dashboard/procurement/po/${po.po_id}`} className="text-green-800 underline hover:text-green-950">
                      {po.po_number || po.po_id.slice(0, 8)}
                    </Link>{" "}
                    ({po.lineCount} line{po.lineCount !== 1 ? "s" : ""})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.failed.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">{result.failed.length} group(s) failed:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.failed.map((f) => (
                  <li key={`${f.groupKey}-${f.error}`}>
                    {f.groupKey}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
