"use client";

import { useEffect, useState } from "react";
import type { Qr } from "@/types/workflows";
import { formatQrStatusLabel } from "@/lib/format";
import { isMovementsService } from "@/lib/serviceTypes";
import { getPurchaseDetailLabel } from "@/lib/qrPurchaseDetails";
import MovementsPostResponsePanel from "@/components/MovementsPostResponsePanel";

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

interface QrDetailModalProps {
  qrId: string;
  onClose: () => void;
  apiPath?: string;
}

export default function QrDetailModal({ qrId, onClose, apiPath }: QrDetailModalProps) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    loadQr();
  }, [qrId]);

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
      const res = await fetch(apiPath ?? `/api/growth/qr/${qrId}`);
      if (res.ok) {
        const data = await res.json();
        setQr(data);
      }
    } catch (error) {
      console.error("Failed to load QR:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="card max-w-2xl border-gray-200 bg-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-8 text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="card max-w-2xl border-gray-200 bg-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-8 text-sm text-gray-500">QR not found</div>
        </div>
      </div>
    );
  }

  const procurementResponse = qr.procurement_response && typeof qr.procurement_response === "object" 
    ? qr.procurement_response 
    : null;
  const metadata = procurementResponse ? (procurementResponse as any)._metadata : null;
  const isReEdited = metadata && metadata.editCount > 0;
  const isMovements = isMovementsService(qr.service_needed ?? "");
  const canEditMovements = isMovements && qr.status === "responded";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="card max-w-2xl border-gray-200 bg-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            QR Details {qr.qr_number && <span className="text-sm font-mono text-gray-600">({qr.qr_number})</span>}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isReEdited && (
          <div className="mb-4">
            <span className="badge border-yellow-500 bg-yellow-50 text-yellow-700 text-xs font-semibold">
              Re-edited by Procurement
            </span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Seller Information */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h4 className="text-xs font-semibold text-gray-900 mb-2 uppercase">Seller Information</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Code:</span>
                <span className="ml-1 font-medium text-gray-900">{qr.reseller_code}</span>
              </div>
              <div>
                <span className="text-gray-500">Contact:</span>
                <span className="ml-1 font-medium text-gray-900">{qr.reseller_contact_no || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">Country:</span>
                <span className="ml-1 font-medium text-gray-900">{qr.reseller_country || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">Service:</span>
                <span className="ml-1 font-medium text-gray-900">{qr.service_needed || "-"}</span>
              </div>
            </div>
          </div>

          {/* Purchase Details */}
          {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-900 uppercase">Purchase Details</h4>
              {qr.purchase_details.map((detail: any, index: number) => {
                const response = procurementResponse?.[index];
                const isItemReEdited = response?.lastEditedAt && response?.lastEditedAt !== response?.submittedAt;
                
                return (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 text-[10px] ${
                      isItemReEdited 
                        ? "border-yellow-300 bg-yellow-50/50" 
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-gray-900 mb-2">
                      {isMovements
                        ? getPurchaseDetailLabel(detail)
                        : (detail.productName || "-")}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {(detail.destinationCountries?.length ? detail.destinationCountries.join(", ") : detail.destinationCountry) && (
                        <div>
                          <span className="text-gray-500">Country(ies):</span>
                          <span className="ml-1 text-gray-900">
                            {detail.destinationCountries?.length ? detail.destinationCountries.join(", ") : detail.destinationCountry}
                          </span>
                        </div>
                      )}
                      {(detail.countryOfPurchase != null && detail.countryOfPurchase !== "") && (
                        <div>
                          <span className="text-gray-500">Purchase From:</span>
                          <span className="ml-1 text-gray-900">{detail.countryOfPurchase}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-gray-500">{isMovements ? "Qty & Unit Price:" : "Qty & Target Price:"}</span>
                        <div className="mt-0.5 text-gray-900">
                          {detail.countryDetails && Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
                            ? detail.countryDetails.map((cd: { country: string; quantity: number; targetPrice: number; unitPrice?: number }) => (
                                <div key={cd.country} className="text-xs">
                                  {cd.country}: {cd.quantity} units · {isMovements ? "Unit" : "Target"}{" "}
                                  {formatTargetPrice(cd.unitPrice ?? cd.targetPrice, cd.country)}
                                </div>
                              ))
                            : (() => {
                                const countries = detail.destinationCountries?.length ? detail.destinationCountries : (detail.destinationCountry ? [detail.destinationCountry] : []);
                                return countries.length > 0
                                  ? countries.map((c: string) => (
                                      <div key={c} className="text-xs">
                                        {c}: {detail.quantity || 0} units · Target {formatTargetPrice(detail.targetPrice, c)}
                                      </div>
                                    ))
                                  : (
                                      <span className="text-xs">{detail.quantity || 0} units · Target {formatTargetPrice(detail.targetPrice, detail.destinationCountry || "")}</span>
                                    );
                              })()}
                        </div>
                      </div>
                      {detail.shipToAddress && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Ship To:</span>
                          <span className="ml-1 text-gray-900">{detail.shipToAddress}</span>
                        </div>
                      )}
                      {detail.remarks && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Remarks:</span>
                          <span className="ml-1 text-gray-900">{detail.remarks}</span>
                        </div>
                      )}
                    </div>

                    {/* Procurement Response */}
                    {response && (
                      <div
                        className={`mt-2 rounded border p-2 ${
                          isItemReEdited
                            ? "border-yellow-400 bg-yellow-100/50"
                            : "border-gray-300 bg-gray-50"
                        }`}
                      >
                        <div className="font-semibold text-gray-900 mb-1">Procurement Response:</div>
                        {response.combinations && Array.isArray(response.combinations) && response.combinations.length > 0 ? (
                          <div className="space-y-2">
                            {response.combinations.map((combo: any, ci: number) => {
                              const currency = combo.currency ?? "AED";
                              return (
                                <div key={ci} className="rounded border border-gray-200 bg-white p-2 text-[9px]">
                                  <div className="font-medium text-gray-800 mb-1">
                                    {combo.destinationCountry} · {combo.countryOfPurchase}
                                    {(combo.shippingType || combo.movementType) && (
                                      <span className="text-gray-600"> · Shipping: {(combo.shippingType ?? "-").toString().replace(/^./, (c: string) => c.toUpperCase())} · Movement: {(combo.movementType ?? "-").toString().replace(/^./, (c: string) => c.toUpperCase())}</span>
                                    )}
                                  </div>
                                  {combo.procurementImagePaths && Array.isArray(combo.procurementImagePaths) && combo.procurementImagePaths.length > 0 && (
                                    <div className="mb-2">
                                      <div className="text-[8px] text-gray-500 mb-0.5">Procurement Images:</div>
                                      <div className="grid grid-cols-3 gap-1">
                                        {combo.procurementImagePaths.map((imagePath: string, imgIndex: number) => {
                                          const imageUrl = imagePath.startsWith("http") ? imagePath : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                                          return (
                                            <img
                                              key={imgIndex}
                                              src={imageUrl}
                                              alt={`Image ${imgIndex + 1}`}
                                              className="h-14 w-full rounded object-cover border border-gray-200 cursor-pointer hover:opacity-90"
                                              onClick={() => window.open(imageUrl, "_blank")}
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E";
                                                target.onerror = null;
                                              }}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-3 gap-1">
                                    {combo.shippingType && <div><span className="text-gray-500">Shipping:</span> <span className="ml-1 font-medium capitalize">{combo.shippingType}</span></div>}
                                    {combo.movementType && <div><span className="text-gray-500">Movement:</span> <span className="ml-1 font-medium capitalize">{combo.movementType}</span></div>}
                                    <div><span className="text-gray-500">Cost:</span> <span className="ml-1 font-medium">{combo.costPerUnit != null ? `${Number(combo.costPerUnit).toFixed(2)} ${currency}` : "-"}</span></div>
                                    <div><span className="text-gray-500">Freight:</span> <span className="ml-1 font-medium">{combo.freightCostPerUnit != null ? `${Number(combo.freightCostPerUnit).toFixed(2)} ${currency}` : "-"}</span></div>
                                    <div><span className="text-gray-500">Landed:</span> <span className="ml-1 font-medium">{combo.landedCostPerUnit != null ? `${Number(combo.landedCostPerUnit).toFixed(2)} ${currency}` : "-"}</span></div>
                                    {(combo.etaDays != null && combo.etaDays !== "") && (
                                      <div><span className="text-gray-500">ETA (Days):</span> <span className="ml-1">{combo.etaDays}</span></div>
                                    )}
                                    {combo.remarks && <div className="col-span-3"><span className="text-gray-500">Remarks:</span> <span className="ml-1">{combo.remarks}</span></div>}
                                  </div>
                                </div>
                              );
                            })}
                            {isItemReEdited && response.lastEditedAt && (
                              <div className="text-[8px] text-yellow-700 font-medium">✏️ Updated {new Date(response.lastEditedAt).toLocaleDateString()}</div>
                            )}
                            {response.warehouseStock && Array.isArray(response.warehouseStock) && response.warehouseStock.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-[9px] font-medium text-gray-700 mb-1">Warehouse stock</div>
                                <div className="space-y-1.5">
                                  {response.warehouseStock.map((row: any, ri: number) => (
                                    <div key={ri} className="rounded border border-gray-100 bg-white p-1.5 text-[9px]">
                                      {row.procurementImagePaths && Array.isArray(row.procurementImagePaths) && row.procurementImagePaths.length > 0 && (
                                        <div className="mb-1">
                                          <div className="grid grid-cols-3 gap-0.5">
                                            {row.procurementImagePaths.map((imagePath: string, imgIdx: number) => {
                                              const imageUrl = imagePath.startsWith("http") ? imagePath : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                                              return (
                                                <img
                                                  key={imgIdx}
                                                  src={imageUrl}
                                                  alt={`Wh image ${imgIdx + 1}`}
                                                  className="h-12 w-full rounded object-cover border border-gray-200 cursor-pointer"
                                                  onClick={() => window.open(imageUrl, "_blank")}
                                                  onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E";
                                                    target.onerror = null;
                                                  }}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-2">
                                        <span><span className="text-gray-500">Warehouse:</span> <span className="font-medium">{row.warehouse ?? "-"}</span></span>
                                        <span><span className="text-gray-500">Qty:</span> <span className="font-medium">{row.qty != null ? Number(row.qty) : "-"}</span></span>
                                        <span><span className="text-gray-500">Cost/unit:</span> <span className="font-medium">{row.costPerUnit != null ? `${Number(row.costPerUnit).toFixed(2)} ${row.currency ?? "AED"}` : "-"}</span></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1 text-[9px]">
                            <div>
                              <span className="text-gray-500">Cost:</span>
                              <span className="ml-1 font-medium text-gray-900">{response.costPerUnit?.toFixed(2) || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Freight:</span>
                              <span className="ml-1 font-medium text-gray-900">{response.freightCostPerUnit?.toFixed(2) || "-"}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Landed:</span>
                              <span className="ml-1 font-medium text-gray-900">{response.landedCostPerUnit?.toFixed(2) || "-"}</span>
                            </div>
                            {response.etaDays !== undefined && response.etaDays !== null && (
                              <div>
                                <span className="text-gray-500">ETA (Days):</span>
                                <span className="ml-1 text-gray-900">{response.etaDays}</span>
                              </div>
                            )}
                            {response.remarks && (
                              <div className="col-span-3">
                                <span className="text-gray-500">Remarks:</span>
                                <span className="ml-1 text-gray-900">{response.remarks}</span>
                              </div>
                            )}
                            {isMovements && response.inventoryAvailable != null && (
                              <div className="col-span-3">
                                <span className="text-gray-500">Inventory Available:</span>
                                <span className="ml-1 font-medium text-gray-900">{response.inventoryAvailable} units</span>
                              </div>
                            )}
                            {isItemReEdited && (
                              <div className="col-span-3 text-[8px] text-yellow-700 font-medium">
                                ✏️ Updated {new Date(response.lastEditedAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Legacy single response: show procurement images only when no combinations (combinations show per-combo above) */}
                        {(!response.combinations || !Array.isArray(response.combinations) || response.combinations.length === 0) &&
                          response.procurementImagePaths &&
                          Array.isArray(response.procurementImagePaths) &&
                          response.procurementImagePaths.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-[9px] text-gray-500">Procurement Images:</div>
                              <div className="grid grid-cols-3 gap-1">
                                {response.procurementImagePaths.map((imagePath: string, imgIndex: number) => {
                                  const imageUrl = imagePath.startsWith("http") ? imagePath : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                                  return (
                                    <img
                                      key={imgIndex}
                                      src={imageUrl}
                                      alt={`Procurement image ${imgIndex + 1}`}
                                      className="h-14 w-full rounded object-cover border border-gray-200 cursor-pointer hover:opacity-90"
                                      onClick={() => window.open(imageUrl, "_blank")}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E";
                                        target.onerror = null;
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {isMovements && response && (
                      <MovementsPostResponsePanel
                        qrId={qrId}
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
          )}

          {/* Created By & Status */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            {(creatorName || qr.created_by_email) && (
              <div className="mb-2 text-[10px]">
                <span className="text-gray-500">Created by:</span>
                <span className="ml-1 font-medium text-gray-900">{creatorName ?? qr.created_by_email?.split("@")[0] ?? "-"}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status:</span>
              <span className="badge text-[10px]">{formatQrStatusLabel(qr.status)}</span>
            </div>
            <div className="mt-2 text-[10px]">
              <div>
                {qr.created_at && qr.updated_at
                  ? `Created at ${formatDate(qr.created_at)} at ${formatTime(qr.created_at)} · Updated: ${formatDate(qr.updated_at)} at ${formatTime(qr.updated_at)}`
                  : qr.created_at
                  ? `Created at ${formatDate(qr.created_at)} at ${formatTime(qr.created_at)}`
                  : "-"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
