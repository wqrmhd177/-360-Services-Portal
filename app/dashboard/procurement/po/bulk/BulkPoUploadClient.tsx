"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  bulkPoCsvTemplate,
  groupBulkPoRows,
  parseBulkPoCsv,
  type BulkPoGroup,
} from "@/lib/poValidation";

type CreatedPo = { po_id: string; po_number?: string | null; lineCount: number };

export default function BulkPoUploadPage() {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: CreatedPo[];
    failed: Array<{ groupKey: string; error: string }>;
  } | null>(null);

  const groups: BulkPoGroup[] = useMemo(() => {
    if (!csvText || parseErrors.length > 0) return [];
    const { rows } = parseBulkPoCsv(csvText);
    return groupBulkPoRows(rows);
  }, [csvText, parseErrors]);

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
      setCsvText(null);
      setFileName(null);
      setParseErrors([]);
      return;
    }

    const text = await file.text();
    const { errors } = parseBulkPoCsv(text);
    setCsvText(text);
    setFileName(file.name);
    setParseErrors(errors);
  }

  async function handleSubmit() {
    if (!csvText || parseErrors.length > 0) return;

    const input = document.getElementById("bulk-po-file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      alert("Please select a CSV file.");
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/procurement/po/bulk", { method: "POST", body: formData });
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
        <Link
          href="/dashboard/procurement/po"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Purchase Orders
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
          Bulk Create Purchase Orders
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV to create independent POs. Rows with the same supplier, location, and delivery
          partner are grouped into one PO with multiple product lines.
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

        {groups.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Preview — {groups.length} PO{groups.length !== 1 ? "s" : ""} will be created
            </h3>
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.groupKey}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
                >
                  <p className="font-medium text-gray-900">
                    {group.supplier_name} · {group.delivery_partner}
                  </p>
                  <p className="text-gray-600">
                    {group.supplier_location} · {group.products.length} product line
                    {group.products.length !== 1 ? "s" : ""}
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-gray-700">
                    {group.products.map((p, i) => (
                      <li key={`${group.groupKey}-${i}`}>
                        {p.productName}
                        {p.skuCode ? ` (${p.skuCode})` : ""} — qty {p.quantity}, product cost{" "}
                        {p.productCostPerUnit?.toFixed(2)}, freight{" "}
                        {p.freightCostPerUnit?.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary disabled:opacity-50"
            >
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
                    <Link
                      href={`/dashboard/procurement/po/${po.po_id}`}
                      className="text-green-800 underline hover:text-green-950"
                    >
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
