"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Qr } from "@/types/workflows";
import QrDetailModal from "@/components/QrDetailModal";
import { formatQrStatusLabel } from "@/lib/format";

// Get currency based on destination country
function getCurrencyForCountry(country: string): string {
  if (!country) return "AED";
  const countryLower = country.toLowerCase();
  if (countryLower.includes("saudi") || countryLower === "saudi arabia") {
    return "SAR";
  }
  if (countryLower.includes("pakistan") || countryLower === "pakistan") {
    return "PKR";
  }
  return "AED";
}

// Format price with commas and currency
function formatTargetPrice(price: number | undefined, country: string): string {
  if (!price) return "-";
  const currency = getCurrencyForCountry(country);
  return `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// Format date as DD/MM/YYYY
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format time as HH:MM AM/PM
function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
}

/** Add N working days (Mon–Fri) to a date. Used for "Convert to PR" eligibility. */
function addWorkingDays(fromDate: Date, workingDays: number): Date {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < workingDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/** True if still within 3 working days of last response/re-edit (rates valid); after that reconfirm required. */
function canConvertQrToPr(qr: Qr): boolean {
  if (qr.status !== "responded") return false;
  const updatedAt = qr.updated_at;
  if (!updatedAt) return true; // no timestamp: allow convert
  const from = new Date(updatedAt);
  const eligibleFrom = addWorkingDays(from, 3);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eligibleFrom.setHours(0, 0, 0, 0);
  return today < eligibleFrom;
}

export default function GrowthQuotationRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [qrs, setQrs] = useState<Qr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);
  const [expandedProcurementCosts, setExpandedProcurementCosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadQrs();
  }, []);

  async function loadQrs() {
    try {
      const res = await fetch("/api/growth/qrs");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setQrs(data);
      } else {
        setQrs([]);
      }
    } catch (error) {
      console.error("Failed to load QRs:", error);
      setQrs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredQrs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQrs.map((qr) => qr.id)));
    }
  }

  function handleSelectOne(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function downloadCSV() {
    const selectedQrs = qrs.filter((qr) => selectedIds.has(qr.id));
    if (selectedQrs.length === 0) {
      alert("Please select at least one QR to download");
      return;
    }

    const headers = [
      "QR Number",
      "ID",
      "Product Name",
      "Customer Code",
      "Purchase Details",
      "Status",
      "Procurement Costs",
      "Remarks",
      "Created At",
      "Updated At"
    ];

    const rows = selectedQrs.map((qr) => {
      const purchaseDetailsStr =
        qr.purchase_details && qr.purchase_details.length > 0
          ? qr.purchase_details
              .map((d: any) => {
                const countries = d.destinationCountries?.length ? d.destinationCountries.join(", ") : (d.destinationCountry || "");
                const psm = [d.countryOfPurchase].filter(Boolean).join(" - ");
                if (d.countryDetails?.length) {
                  const parts = d.countryDetails.map((cd: { country: string; quantity: number; targetPrice: number }) =>
                    `${cd.country}: ${cd.quantity} qty, Target ${formatTargetPrice(cd.targetPrice, cd.country)}`
                  ).join(" | ");
                  return `${parts}${psm ? ` - ${psm}` : ""}`;
                }
                const targetStr = d.targetPrice != null ? ` Target: ${formatTargetPrice(d.targetPrice, d.destinationCountries?.[0] || d.destinationCountry || "")}` : "";
                return `${countries} (${d.quantity} qty)${targetStr}${psm ? ` - ${psm}` : ""}`;
              })
              .join(" | ")
          : "";

      const costsStr =
        qr.procurement_response && typeof qr.procurement_response === "object"
          ? qr.purchase_details
              ?.map((detail: any, idx: number) => {
                const response = (qr.procurement_response as any)[idx];
                if (response?.combinations?.length) {
                  return response.combinations
                    .map((c: any) => `${c.destinationCountry} (${c.countryOfPurchase}${c.shippingType || c.movementType ? ` · ${c.shippingType ?? "-"}/${c.movementType ?? "-"}` : ""}): Cost=${c.costPerUnit ?? "-"}, Freight=${c.freightCostPerUnit ?? "-"}, Landed=${c.landedCostPerUnit ?? "-"}`)
                    .join(" | ");
                }
                if (response?.costPerUnit != null) {
                  const country = detail.destinationCountries?.[0] || detail.destinationCountry || "—";
                  return `${country}: Cost=${response.costPerUnit}, Freight=${response.freightCostPerUnit ?? "-"}, Landed=${response.landedCostPerUnit ?? "-"}`;
                }
                const country = detail.destinationCountries?.join(", ") || detail.destinationCountry || "—";
                return `${country}: Pending`;
              })
              .join(" | ") || ""
          : "";

      const productNamesStr =
        qr.purchase_details && qr.purchase_details.length > 0
          ? qr.purchase_details.map((d: any) => d.productName).join(" | ")
          : "";

      return [
        qr.qr_number || qr.id,
        qr.id,
        productNamesStr,
        qr.reseller_code,
        purchaseDetailsStr,
        qr.status,
        costsStr,
        qr.remarks || "",
        qr.created_at ? new Date(qr.created_at).toLocaleString() : "",
        qr.updated_at ? new Date(qr.updated_at).toLocaleString() : ""
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `quotation-requests-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const safeQrs = Array.isArray(qrs) ? qrs : [];
  const filteredQrs =
    statusFilter === "all"
      ? safeQrs
      : safeQrs.filter((qr) => (qr?.status ?? "") === statusFilter);

  const statusCounts = {
    all: safeQrs.length,
    open: safeQrs.filter((q) => (q?.status ?? "") === "open").length,
    responded: safeQrs.filter((q) => (q?.status ?? "") === "responded").length,
    converted_to_pr: safeQrs.filter((q) => (q?.status ?? "") === "converted_to_pr").length,
    canceled: safeQrs.filter((q) => (q?.status ?? "") === "canceled").length
  };

  const showReconfirmMessage = searchParams?.get("message") === "reconfirm_rates";

  return (
    <div className="space-y-6">
      {showReconfirmMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Convert to PR is available within 3 working days of the last response or re-edit by Procurement. After that, please reconfirm rates with Procurement before converting.
        </div>
      )}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Quotation Request History</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "all"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusFilter("open")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "open"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Open ({statusCounts.open})
            </button>
            <button
              onClick={() => setStatusFilter("responded")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "responded"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Responded ({statusCounts.responded})
            </button>
            <button
              onClick={() => setStatusFilter("converted_to_pr")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "converted_to_pr"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Converted to PR ({statusCounts.converted_to_pr})
            </button>
            <button
              onClick={() => setStatusFilter("canceled")}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statusFilter === "canceled"
                  ? "border-portal-400 bg-portal-400/20 text-portal-900 font-semibold"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Canceled ({statusCounts.canceled})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : filteredQrs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No quotation requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredQrs.length && filteredQrs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 bg-white"
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">QR Number</th>
                  <th className="px-3 py-3 text-left font-medium">Product</th>
                  <th className="px-3 py-3 text-left font-medium">Customer</th>
                  <th className="px-3 py-3 text-left font-medium">Purchase Details</th>
                  <th className="px-3 py-3 text-center font-medium !text-center">Status</th>
                  <th className="px-3 py-3 text-left font-medium">Procurement Costs</th>
                  <th className="px-3 py-3 text-right font-medium !text-right">Created</th>
                  <th className="px-3 py-3 text-center font-medium !text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQrs.map((qr) => {
                  // Check if QR has been re-edited by Procurement
                  const procurementResponse = qr.procurement_response && typeof qr.procurement_response === "object" 
                    ? qr.procurement_response 
                    : null;
                  const metadata = procurementResponse ? (procurementResponse as any)._metadata : null;
                  const isReEdited = metadata && metadata.editCount > 0;
                  
                  return (
                  <tr
                    key={qr.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                      isReEdited ? "bg-yellow-50/50 border-yellow-200" : ""
                    }`}
                  >
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(qr.id)}
                        onChange={() => handleSelectOne(qr.id)}
                        className="rounded border-gray-300 bg-white"
                      />
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      {qr.qr_number ? (
                        <span className="font-mono text-xs font-semibold text-gray-900">{qr.qr_number}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-gray-900 font-medium">
                      <div className="text-xs">
                        {qr.purchase_details && qr.purchase_details.length > 0 ? (
                          <div className="space-y-1">
                            {qr.purchase_details.map((detail: any, idx: number) => (
                              <div key={idx} className="font-medium text-gray-900 leading-relaxed">
                                {detail.productName}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-gray-700 whitespace-nowrap">{qr.reseller_code}</td>
                    <td className="px-3 py-3 align-top text-gray-700 max-w-[280px]">
                      <div className="text-xs break-words">
                        {qr.purchase_details && qr.purchase_details.length > 0 ? (
                          <div className="space-y-1">
                            {qr.purchase_details.map((detail: any, idx: number) => {
                              const countries = detail.destinationCountries?.length ? detail.destinationCountries.join(", ") : (detail.destinationCountry || "—");
                              const psm = [detail.countryOfPurchase].filter(Boolean).join(" · ");
                              const qtyTarget = detail.countryDetails?.length
                                ? detail.countryDetails.map((cd: { country: string; quantity: number; targetPrice: number }) =>
                                    `${cd.country}: ${cd.quantity} qty, Target ${formatTargetPrice(cd.targetPrice, cd.country)}`
                                  ).join(" · ")
                                : `${detail.quantity} qty, Target: ${detail.targetPrice != null ? formatTargetPrice(detail.targetPrice, detail.destinationCountries?.[0] || detail.destinationCountry || "") : "—"}`;
                              return (
                                <div key={idx} className="text-[10px] leading-relaxed">
                                  {detail.productName} → {countries} ({qtyTarget}){psm ? ` · ${psm}` : ""}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-500">No details</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-center !text-center">
                      <div className="flex items-start justify-center gap-2 flex-wrap">
                        <span className="badge">{formatQrStatusLabel(qr?.status)}</span>
                        {isReEdited && (
                          <span className="badge border-yellow-500 bg-yellow-50 text-yellow-700 text-[10px] font-semibold">
                            Re-edited by Procurement
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top max-w-[240px]">
                      {qr.procurement_response &&
                      typeof qr.procurement_response === "object" &&
                      Object.keys(qr.procurement_response).length > 0 ? (() => {
                        const resp = qr.procurement_response as any;
                        let totalBlocks = 0;
                        (qr.purchase_details || []).forEach((_: any, idx: number) => {
                          const r = resp[idx];
                          if (r?.combinations?.length) totalBlocks += r.combinations.length;
                          else if (r?.costPerUnit != null) totalBlocks += 1;
                        });
                        const isExpanded = expandedProcurementCosts.has(qr.id);
                        const showCollapse = totalBlocks > 1;
                        const toggle = () => {
                          setExpandedProcurementCosts((prev) => {
                            const next = new Set(prev);
                            if (next.has(qr.id)) next.delete(qr.id);
                            else next.add(qr.id);
                            return next;
                          });
                        };
                        return (
                          <div className="space-y-1 text-[10px] break-words">
                            {showCollapse && (
                              <button
                                type="button"
                                onClick={toggle}
                                className="flex items-center gap-1.5 text-left text-gray-700 hover:text-gray-900 font-medium"
                              >
                                {isExpanded ? (
                                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                ) : (
                                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                )}
                                <span>{totalBlocks} combination{totalBlocks !== 1 ? "s" : ""}</span>
                              </button>
                            )}
                            {(!showCollapse || isExpanded) && (
                              <div className={showCollapse ? "mt-1 space-y-1" : ""}>
                                {qr.purchase_details?.map((detail: any, idx: number) => {
                                  const response = resp[idx];
                                  const isItemReEdited = response?.lastEditedAt && response?.lastEditedAt !== response?.submittedAt;
                                  const countryLabel = detail.destinationCountries?.length ? detail.destinationCountries.join(", ") : (detail.destinationCountry || "—");
                                  if (response?.combinations?.length) {
                                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uengcejyjagdcqecnlkr.supabase.co";
                                    return (
                                      <div key={idx} className="space-y-1.5">
                                        {response.combinations.map((c: any, ci: number) => {
                                          const currency = c.currency ?? "AED";
                                          return (
                                            <div key={ci} className={`rounded-xl border p-2 text-[9px] ${isItemReEdited ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-gray-50"}`}>
                                              {c.procurementImagePaths?.length > 0 && (
                                                <div className="flex gap-0.5 mb-1 flex-wrap">
                                                  {c.procurementImagePaths.slice(0, 3).map((path: string, imgIdx: number) => {
                                                    const url = path.startsWith("http") ? path : `${supabaseUrl}/storage/v1/object/public/qr-attachments/${path}`;
                                                    return <img key={imgIdx} src={url} alt="" className="h-10 w-10 rounded object-cover border border-gray-200 cursor-pointer" onClick={() => window.open(url, "_blank")} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
                                                  })}
                                                  {c.procurementImagePaths.length > 3 && <span className="text-[8px] text-gray-400 self-center">+{c.procurementImagePaths.length - 3}</span>}
                                                </div>
                                              )}
                                              <div className="font-medium text-gray-900">{c.destinationCountry} · {c.countryOfPurchase}{c.shippingType || c.movementType ? ` · Shipping: ${(c.shippingType ?? "-").replace(/^./, (s: string) => s.toUpperCase())} · Movement: ${(c.movementType ?? "-").replace(/^./, (s: string) => s.toUpperCase())}` : ""}</div>
                                              <div className="text-gray-700">Cost: {c.costPerUnit != null ? `${Number(c.costPerUnit).toFixed(2)} ${currency}` : "-"} | Freight: {c.freightCostPerUnit != null ? `${Number(c.freightCostPerUnit).toFixed(2)} ${currency}` : "-"} | Landed: {c.landedCostPerUnit != null ? `${Number(c.landedCostPerUnit).toFixed(2)} ${currency}` : "-"}</div>
                                            </div>
                                          );
                                        })}
                                        {response.warehouseStock && Array.isArray(response.warehouseStock) && response.warehouseStock.length > 0 && (
                                          <div className="mt-1 pt-1 border-t border-gray-200">
                                            <div className="text-[8px] font-medium text-gray-500 uppercase mb-0.5">Warehouse</div>
                                            {response.warehouseStock.map((row: any, ri: number) => (
                                              <div key={ri} className="text-[9px] flex flex-wrap items-center gap-1">
                                                {row.procurementImagePaths?.length > 0 && (
                                                  <>
                                                    {row.procurementImagePaths.slice(0, 2).map((path: string, imgIdx: number) => {
                                                      const url = path.startsWith("http") ? path : `${supabaseUrl}/storage/v1/object/public/qr-attachments/${path}`;
                                                      return <img key={imgIdx} src={url} alt="" className="h-8 w-8 rounded object-cover border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
                                                    })}
                                                    <span className="font-medium">{row.warehouse ?? "-"}</span> · {row.qty ?? "-"} · {row.costPerUnit != null ? `${Number(row.costPerUnit).toFixed(2)} ${row.currency ?? "AED"}` : "-"}
                                                  </>
                                                )}
                                                {(!row.procurementImagePaths || row.procurementImagePaths.length === 0) && (
                                                  <span><span className="font-medium">{row.warehouse ?? "-"}</span> · Qty {row.qty ?? "-"} · Cost/unit {row.costPerUnit != null ? `${Number(row.costPerUnit).toFixed(2)} ${row.currency ?? "AED"}` : "-"}</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {isItemReEdited && response.lastEditedAt && <div className="text-[9px] text-yellow-700 font-medium">✏️ Updated {new Date(response.lastEditedAt).toLocaleDateString()}</div>}
                                      </div>
                                    );
                                  }
                                  if (response?.costPerUnit != null) {
                                    return (
                                      <div key={idx} className={`rounded-xl border p-2 ${isItemReEdited ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-gray-50"}`}>
                                        <div className="font-medium text-gray-900">{countryLabel}</div>
                                        <div className="text-gray-700">Cost: {response.costPerUnit?.toFixed(2) || "-"} | Freight: {response.freightCostPerUnit?.toFixed(2) || "-"} | Landed: {response.landedCostPerUnit?.toFixed(2) || "-"}</div>
                                        {isItemReEdited && response.lastEditedAt && <div className="mt-1 text-[9px] text-yellow-700 font-medium">✏️ Updated {new Date(response.lastEditedAt).toLocaleDateString()}</div>}
                                      </div>
                                    );
                                  }
                                  return <div key={idx} className="text-gray-500">Pending...</div>;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-gray-500 text-[10px] leading-relaxed !text-right">
                      {qr.created_at && qr.updated_at
                        ? (
                          <div className="space-y-0.5 text-right">
                            <div>Created:{formatDate(qr.created_at)}</div>
                            <div>Updated:{formatDate(qr.updated_at)} at {formatTime(qr.updated_at)}</div>
                          </div>
                        )
                        : qr.created_at
                        ? `Created:${formatDate(qr.created_at)}`
                        : "-"}
                    </td>
                    <td className="px-3 py-3 align-top text-center !text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedQrId(qr.id)}
                          className="text-gray-700 hover:text-gray-900 transition-colors"
                          title="View Details"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </button>
                        {qr.status === "responded" && (
                          canConvertQrToPr(qr) ? (
                            <Link
                              href={`/dashboard/growth/qr/${qr.id}/convert`}
                              className="text-xs font-medium text-gray-900 hover:text-gray-700"
                            >
                              Convert to PR
                            </Link>
                          ) : (
                            <span className="text-xs font-medium text-amber-700" title="Rates valid for 3 working days. After that, reconfirm rates with Procurement before converting to PR.">
                              Reconfirm Rates
                            </span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Detail Modal */}
      {selectedQrId && (
        <QrDetailModal
          qrId={selectedQrId}
          onClose={() => setSelectedQrId(null)}
        />
      )}
    </div>
  );
}
