"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Qr } from "@/types/workflows";
import { formatQrStatusLabel } from "@/lib/format";
import { isMovementsService, isLogisticsService } from "@/lib/serviceTypes";
import { getPurchaseDetailLabel } from "@/lib/qrPurchaseDetails";
import MovementsPostResponsePanel from "@/components/MovementsPostResponsePanel";
import PendingMovementSummary from "@/components/PendingMovementSummary";
import { qrHasPendingMovement } from "@/lib/qrPurchaseDetails";

function ReadField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`space-y-0.5 ${wide ? "sm:col-span-2 md:col-span-3" : ""}`}>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="text-sm text-gray-900">{value || "—"}</div>
    </div>
  );
}

// Get Supabase URL from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uengcejyjagdcqecnlkr.supabase.co";

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
function formatTargetPrice(
  price: number | undefined,
  country: string,
  explicitCurrency?: "AED" | "SAR" | "PKR"
): string {
  if (!price) return "-";
  const currency = explicitCurrency ?? (getCurrencyForCountry(country) as "AED" | "SAR" | "PKR");
  return `${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
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

export default function GrowthQrViewPage({ params }: { params: { id: string } }) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    loadQr();
  }, [params.id]);

  useEffect(() => {
    if (!qr?.created_by_email) return;
    fetch("/api/users/names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: [qr.created_by_email] }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.names?.[qr.created_by_email]) {
          setCreatorName(data.names[qr.created_by_email]);
        } else {
          setCreatorName(qr.created_by_email.split("@")[0]);
        }
      })
      .catch(() => setCreatorName(qr.created_by_email?.split("@")[0] ?? null));
  }, [qr?.id, qr?.created_by_email]);

  async function loadQr() {
    try {
      const res = await fetch(`/api/growth/qr/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setQr(data);
      } else {
        setError("QR not found");
      }
    } catch (error) {
      console.error("Failed to load QR:", error);
      setError("Failed to load QR details");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-sm text-gray-500">Loading QR details...</div>
      </div>
    );
  }

  if (error || !qr) {
    return (
      <div className="space-y-6">
        <div className="card">
          <p className="text-sm text-gray-500">{error || "QR not found"}</p>
          <Link href="/dashboard/growth/quotation-requests" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
            ← Back to Quotation Requests
          </Link>
        </div>
      </div>
    );
  }

  // Check if QR has been re-edited by Procurement
  const procurementResponse = qr.procurement_response && typeof qr.procurement_response === "object" 
    ? qr.procurement_response 
    : null;
  const metadata = procurementResponse ? (procurementResponse as any)._metadata : null;
  const isReEdited = metadata && metadata.editCount > 0;
  const isMovements = isMovementsService(qr.service_needed ?? "");
  const canEditMovements = isMovements && qr.status === "responded";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Quotation Request Details {qr.qr_number && <span className="text-lg font-mono text-gray-600">({qr.qr_number})</span>}
          </h2>
          {isReEdited && (
            <div className="mt-2">
              <span className="badge border-yellow-500 bg-yellow-50 text-yellow-700 text-xs font-semibold">
                Re-edited by Procurement
              </span>
            </div>
          )}
        </div>
        <Link href="/dashboard/growth/quotation-requests" className="text-xs font-medium text-gray-900 hover:text-gray-700">
          ← Back to Quotation Requests
        </Link>
      </div>

      {/* Customer Information */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Seller Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Customer Name / Code</label>
            <div className="text-sm font-medium text-gray-900">{qr.reseller_code}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Seller Contact No.</label>
            <div className="text-sm font-medium text-gray-900">{qr.reseller_contact_no || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Seller Country</label>
            <div className="text-sm font-medium text-gray-900">{qr.reseller_country || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Existing Seller of Zambeel</label>
            <div className="text-sm font-medium text-gray-900">{qr.existing_seller || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Gold Seller of Zambeel</label>
            <div className="text-sm font-medium text-gray-900">{qr.gold_seller || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Service Needed</label>
            <div className="text-sm font-medium text-gray-900">{qr.service_needed || "-"}</div>
          </div>
        </div>
      </div>

      {qrHasPendingMovement(qr) && (
        <div className="card">
          <PendingMovementSummary qr={qr} />
        </div>
      )}

      {/* QR Details — consolidated read-only view of all creation fields */}
      {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0 && (() => {
        const isLogistics = isLogisticsService(qr.service_needed ?? "");
        return (
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">QR Details</h3>
            <div className="space-y-4">
              {(qr.purchase_details as any[]).map((detail: any, index: number) => (
                <div key={index} className={`${qr.purchase_details!.length > 1 ? "rounded-lg border border-gray-100 bg-gray-50/50 p-4" : ""}`}>
                  {qr.purchase_details!.length > 1 && (
                    <p className="mb-3 text-xs font-semibold text-gray-600 uppercase">Product {index + 1}</p>
                  )}
                  {isLogistics ? (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {detail.productName && (
                        <ReadField label="Product Name" value={detail.productName} />
                      )}
                      {detail.shipFrom && (
                        <ReadField label="Ship From" value={detail.shipFrom} />
                      )}
                      {detail.shipTo && (
                        <ReadField label="Ship To" value={detail.shipTo} />
                      )}
                      {detail.shippingType && (
                        <ReadField label="Shipping Type" value={detail.shippingType} />
                      )}
                      {detail.productType && (
                        <ReadField label="Product Type" value={detail.productType} />
                      )}
                      {detail.hasBrand && (
                        <ReadField label="Brand" value={detail.hasBrand} />
                      )}
                      {detail.noOfCartons != null && (
                        <ReadField label="No of Cartons" value={String(detail.noOfCartons)} />
                      )}
                      {detail.weightPerCarton != null && (
                        <ReadField label="Weight per Carton" value={`${detail.weightPerCarton} kg`} />
                      )}
                      {(detail.cartonLength || detail.cartonWidth || detail.cartonHeight) && (
                        <ReadField
                          label="Carton Dimensions (L×W×H cm)"
                          value={`${detail.cartonLength ?? "-"} × ${detail.cartonWidth ?? "-"} × ${detail.cartonHeight ?? "-"}`}
                        />
                      )}
                      {detail.remarks && (
                        <ReadField label="Remarks" value={detail.remarks} wide />
                      )}
                      {/* Packing list attachments */}
                      {detail.imagePaths && Array.isArray(detail.imagePaths) && detail.imagePaths.length > 0 && (
                        <div className="sm:col-span-2 md:col-span-3 space-y-1">
                          <label className="text-xs font-medium text-gray-500">Packing List / Attachments</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(detail.imagePaths as string[]).map((path: string, ii: number) => {
                              const url = path.startsWith("http") ? path : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${path}`;
                              const isDoc = !url.match(/\.(png|jpe?g|gif|webp)(\?|$)/i);
                              return isDoc ? (
                                <a key={ii} href={url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200">
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  {path.split("/").pop()}
                                </a>
                              ) : (
                                <button key={ii} type="button" onClick={() => window.open(url, "_blank")}
                                  className="h-12 w-12 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 hover:opacity-90">
                                  <img src={url} alt={`attachment ${ii + 1}`} className="h-full w-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {detail.productName && !isMovements && (
                        <ReadField label="Product Name" value={detail.productName} />
                      )}
                      {isMovements && (
                        <ReadField label="Movement" value={`${detail.fromSku ?? "-"} → ${detail.toSku ?? "-"}`} />
                      )}
                      {(detail.destinationCountries?.length || detail.destinationCountry) && (
                        <ReadField
                          label="Destination"
                          value={detail.destinationCountries?.join(", ") ?? detail.destinationCountry}
                        />
                      )}
                      {detail.countryDetails && Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
                        ? detail.countryDetails.map((cd: any, ci: number) => (
                            <ReadField
                              key={ci}
                              label={`${cd.country} — Qty / Target Price`}
                              value={`${cd.quantity ?? 0} · ${formatTargetPrice(cd.targetPrice, cd.country, cd.currency)}`}
                            />
                          ))
                        : detail.quantity != null && (
                            <ReadField label="Qty / Target Price" value={`${detail.quantity} · ${formatTargetPrice(detail.targetPrice, detail.destinationCountry ?? "")}`} />
                          )
                      }
                      {detail.shipToAddress && (
                        <ReadField label="Ship To Address" value={detail.shipToAddress} wide />
                      )}
                      {detail.remarks && (
                        <ReadField label="Remarks" value={detail.remarks} wide />
                      )}
                      {/* Reference images */}
                      {detail.imagePaths && Array.isArray(detail.imagePaths) && detail.imagePaths.length > 0 && (
                        <div className="sm:col-span-2 md:col-span-3 space-y-1">
                          <label className="text-xs font-medium text-gray-500">Reference Images</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(detail.imagePaths as string[]).map((path: string, ii: number) => {
                              const url = path.startsWith("http") ? path : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${path}`;
                              return (
                                <button key={ii} type="button" onClick={() => window.open(url, "_blank")}
                                  className="h-12 w-12 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 hover:opacity-90">
                                  <img src={url} alt={`img ${ii + 1}`} className="h-full w-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Purchase Details - compact table: one row per product */}
      {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0 && (
        <div className="card overflow-x-auto">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Purchase Details</h3>
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Product</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Country</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Qty & Target Price</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600 w-28">Images</th>
              </tr>
            </thead>
            <tbody>
              {qr.purchase_details.map((detail: any, index: number) => {
                const response = procurementResponse?.[index];
                const isItemReEdited = response?.lastEditedAt && response?.lastEditedAt !== response?.submittedAt;
                const countryStr = detail.destinationCountries?.length ? detail.destinationCountries.join(", ") : (detail.destinationCountry || "-");
                const qtyTargetStr = detail.countryDetails && Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
                  ? detail.countryDetails.map((cd: { country: string; quantity: number; targetPrice: number; currency?: "AED" | "SAR" | "PKR" }) =>
                      `${cd.country}: ${cd.quantity} · ${formatTargetPrice(cd.targetPrice, cd.country, cd.currency)}`
                    ).join("; ")
                  : (() => {
                      const countries = detail.destinationCountries?.length ? detail.destinationCountries : (detail.destinationCountry ? [detail.destinationCountry] : []);
                      return countries.length > 0
                        ? countries.map((c: string) => `${c}: ${detail.quantity || 0} · ${formatTargetPrice(detail.targetPrice, c)}`).join("; ")
                        : `${detail.quantity || 0} · ${formatTargetPrice(detail.targetPrice, detail.destinationCountry || "")}`;
                    })();
                const imagePaths = detail.imagePaths && Array.isArray(detail.imagePaths) ? detail.imagePaths : [];

                return (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 ${isItemReEdited ? "bg-yellow-50/50" : ""}`}
                  >
                    <td className="py-2 px-3 align-top">
                      <div className="font-medium text-gray-900">
                        {isMovements ? getPurchaseDetailLabel(detail) : (detail.productName || "-")}
                      </div>
                      {(detail.shipToAddress || detail.remarks) && (
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          {detail.shipToAddress && <span>Ship to: {detail.shipToAddress}</span>}
                          {detail.shipToAddress && detail.remarks && " · "}
                          {detail.remarks && <span>{detail.remarks}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 align-top text-gray-700">{countryStr}</td>
                    <td className="py-2 px-3 align-top text-gray-700 whitespace-nowrap">{qtyTargetStr}</td>
                    <td className="py-2 px-3 align-top">
                      {imagePaths.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {imagePaths.slice(0, 4).map((imagePath: string, imgIndex: number) => {
                            const imageUrl = imagePath.startsWith("http") ? imagePath : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                            return (
                              <button
                                key={imgIndex}
                                type="button"
                                onClick={() => window.open(imageUrl, "_blank")}
                                className="h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 object-cover hover:opacity-90"
                              >
                                <img
                                  src={imageUrl}
                                  alt={`${detail.productName} ${imgIndex + 1}`}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23ddd' width='40' height='40'/%3E%3Ctext fill='%23999' font-size='10' x='20' y='22' text-anchor='middle'%3E?%3C/text%3E%3C/svg%3E`;
                                    target.onerror = null;
                                  }}
                                />
                              </button>
                            );
                          })}
                          {imagePaths.length > 4 && <span className="text-[10px] text-gray-500">+{imagePaths.length - 4}</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Procurement responses - compact block below table */}
          {qr.purchase_details.some((_: any, idx: number) => procurementResponse?.[idx]) && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <div className="text-[10px] font-medium text-gray-500 uppercase mb-2">Procurement Response</div>
              <div className="space-y-2">
                {qr.purchase_details.map((detail: any, index: number) => {
                  const response = procurementResponse?.[index];
                  if (!response) return null;
                  const isItemReEdited = response?.lastEditedAt && response?.lastEditedAt !== response?.submittedAt;
                  return (
                    <div
                      key={index}
                      className={`rounded border px-3 py-2 text-xs ${isItemReEdited ? "border-yellow-300 bg-yellow-50/50" : "border-gray-200 bg-gray-50/50"}`}
                    >
                      <span className="font-medium text-gray-800">
                        {isMovements ? getPurchaseDetailLabel(detail) : detail.productName}:
                      </span>{" "}
                      {response.combinations?.length > 0
                        ? response.combinations.map((c: any) => {
                            const currency = c.currency ?? "AED";
                            const ship = c.shippingType ? ` ${(c.shippingType as string).replace(/^./, (s: string) => s.toUpperCase())}` : "";
                            const move = c.movementType ? ` ${(c.movementType as string).replace(/^./, (s: string) => s.toUpperCase())}` : "";
                            return `${c.destinationCountry}${ship && move ? ` (${ship.trim()}/${move.trim()})` : ""} Cost ${c.costPerUnit != null ? `${Number(c.costPerUnit).toFixed(2)} ${currency}` : "-"} / Freight ${c.freightCostPerUnit != null ? `${Number(c.freightCostPerUnit).toFixed(2)} ${currency}` : "-"} / Landed ${c.landedCostPerUnit != null ? `${Number(c.landedCostPerUnit).toFixed(2)} ${currency}` : "-"}`;
                          }).join(" · ")
                        : `Cost ${response.costPerUnit?.toFixed(2) ?? "-"} / Freight ${response.freightCostPerUnit?.toFixed(2) ?? "-"} / Landed ${response.landedCostPerUnit?.toFixed(2) ?? "-"}`}
                      {isMovements && response.inventoryAvailable != null && (
                        <span className="ml-2 text-gray-700">
                          · Inventory Available: {response.inventoryAvailable} units
                        </span>
                      )}
                      {isItemReEdited && <span className="ml-2 text-[10px] text-yellow-700">(Updated)</span>}
                      {response.combinations?.length > 0 && response.combinations.some((c: any) => c.procurementImagePaths?.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {response.combinations.map((c: any, ci: number) =>
                            c.procurementImagePaths?.length > 0 ? (
                              <span key={ci} className="text-[9px] text-gray-500">
                                {c.destinationCountry}: {c.procurementImagePaths.length} image{c.procurementImagePaths.length !== 1 ? "s" : ""}
                              </span>
                            ) : null
                          ).filter(Boolean)}
                        </div>
                      )}
                      {response.warehouseStock && Array.isArray(response.warehouseStock) && response.warehouseStock.length > 0 && (
                        <div className="mt-2 border-t border-gray-200 pt-2">
                          <div className="text-[10px] font-medium text-gray-500 uppercase mb-1">Warehouse stock</div>
                          <div className="space-y-1.5">
                            {response.warehouseStock.map((row: any, ri: number) => (
                              <div key={ri} className="text-[10px]">
                                {row.procurementImagePaths?.length > 0 && (
                                  <div className="flex gap-0.5 mb-0.5">
                                    {row.procurementImagePaths.slice(0, 3).map((path: string, imgIdx: number) => {
                                      const url = path.startsWith("http") ? path : `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uengcejyjagdcqecnlkr.supabase.co"}/storage/v1/object/public/qr-attachments/${path}`;
                                      return (
                                        <img key={imgIdx} src={url} alt="" className="h-8 w-8 rounded object-cover border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                      );
                                    })}
                                    {row.procurementImagePaths.length > 3 && <span className="text-[9px] text-gray-400">+{row.procurementImagePaths.length - 3}</span>}
                                  </div>
                                )}
                                <span className="font-medium">{row.warehouse ?? "-"}</span> · Qty {row.qty != null ? Number(row.qty) : "-"} · Cost/unit {row.costPerUnit != null ? `${Number(row.costPerUnit).toFixed(2)} ${row.currency ?? "AED"}` : "-"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isMovements && (
                        <MovementsPostResponsePanel
                          qrId={params.id}
                          detailIndex={index}
                          detail={detail}
                          inventoryAvailable={response.inventoryAvailable}
                          editable={canEditMovements}
                          onUpdated={(purchaseDetails) =>
                            setQr((prev) =>
                              prev ? { ...prev, purchase_details: purchaseDetails as Qr["purchase_details"] } : prev
                            )
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status and Dates */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Status & Timeline</h3>
        <div className="grid gap-4 md:grid-cols-2 text-xs">
          {(creatorName || qr.created_by_email) && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Created By</label>
              <div className="text-sm font-medium text-gray-900">
                {creatorName ?? qr.created_by_email?.split("@")[0] ?? "-"}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase">Status</label>
            <div>
              <span className="badge">{formatQrStatusLabel(qr?.status)}</span>
            </div>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-medium text-gray-500 uppercase">Created At</label>
            <div className="text-sm font-medium text-gray-900">
              {qr.created_at && qr.updated_at
                ? `Created at ${formatDate(qr.created_at)} at ${formatTime(qr.created_at)} · Updated: ${formatDate(qr.updated_at)} at ${formatTime(qr.updated_at)}`
                : qr.created_at
                ? `Created at ${formatDate(qr.created_at)} at ${formatTime(qr.created_at)}`
                : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Convert to PR button if status is responded */}
      {qr.status === "responded" && (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/growth/qr/${qr.id}/convert`}
            className="btn-primary"
          >
            Convert to PR
          </Link>
        </div>
      )}
    </div>
  );
}
