"use client";

import React, { useState, useEffect } from "react";
import { Qr } from "@/types/workflows";
import { formatQrStatusLabel } from "@/lib/format";
import ImageGallery from "@/components/ImageGallery";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uengcejyjagdcqecnlkr.supabase.co";
const QR_ATTACHMENTS_BASE = `${SUPABASE_URL}/storage/v1/object/public/qr-attachments`;

function toPublicUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${QR_ATTACHMENTS_BASE}/${path}`;
}

interface QuotationSummaryProps {
  qr: Qr;
}

export default function QuotationSummary({ qr }: QuotationSummaryProps) {
  const [expandedDetail, setExpandedDetail] = useState<number | null>(0);
  const [creatorName, setCreatorName] = useState<string | null>(null);

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

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const toggleDetail = (index: number) => {
    setExpandedDetail(expandedDetail === index ? null : index);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden sticky top-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Quotation Summary</h2>
        <p className="text-sm text-green-100 mt-1">
          Complete QR details with procurement responses
        </p>
      </div>

      <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto space-y-6">
        {/* Customer Information */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Seller Information
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Channel Name/User ID</p>
              <p className="font-medium text-gray-900">{qr.reseller_code}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Contact Number</p>
              <p className="font-medium text-gray-900">
                {qr.reseller_contact_no}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Country</p>
              <p className="font-medium text-gray-900">{qr.reseller_country}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Service Type</p>
              <p className="font-medium text-gray-900">{qr.service_needed}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Existing Seller</p>
              <p className="font-medium text-gray-900">
                {qr.existing_seller}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-600 mb-1">Gold Seller</p>
              <p className="font-medium text-gray-900">{qr.gold_seller}</p>
            </div>
          </div>
        </div>

        {/* Purchase Details */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            Purchase Details ({qr.purchase_details?.length || 0})
          </h3>

          <div className="space-y-3">
            {qr.purchase_details && qr.purchase_details.length > 0 ? (
              qr.purchase_details.map((detail: any, index: number) => {
                const procResponse =
                  qr.procurement_response &&
                  typeof qr.procurement_response === "object"
                    ? (qr.procurement_response as any)[index]
                    : null;

                return (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Detail Header (Collapsible) */}
                    <button
                      onClick={() => toggleDetail(index)}
                      className="w-full bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-900 text-left">
                          {detail.productName || "Product"}
                        </span>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          expandedDetail === index ? "transform rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Detail Content */}
                    {expandedDetail === index && (
                      <div className="p-4 space-y-4 bg-white">
                        {/* Product Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-600">Destination</p>
                            <p className="font-medium text-gray-900">
                              {(detail.destinationCountries?.length ? detail.destinationCountries.join(", ") : detail.destinationCountry) || "—"}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-600">Quantity & Target Price</p>
                            <p className="font-medium text-gray-900 mt-0.5">
                              {detail.countryDetails && Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
                                ? detail.countryDetails.map((cd: { country: string; quantity: number; targetPrice: number }) => (
                                    <span key={cd.country} className="block text-xs">
                                      {cd.country}: {cd.quantity} units · Target {cd.targetPrice != null ? `${cd.targetPrice.toFixed(2)}` : "—"}
                                    </span>
                                  ))
                                : (() => {
                                    const countries = detail.destinationCountries?.length ? detail.destinationCountries : (detail.destinationCountry ? [detail.destinationCountry] : []);
                                    return countries.length > 0
                                      ? countries.map((c: string) => (
                                          <span key={c} className="block text-xs">
                                            {c}: {detail.quantity ?? 0} units · Target {detail.targetPrice != null ? detail.targetPrice : "—"}
                                          </span>
                                        ))
                                      : (
                                          <span className="text-xs">{detail.quantity ?? 0} units · Target {detail.targetPrice ?? "—"}</span>
                                        );
                                  })()}
                            </p>
                          </div>
                          {detail.countryOfPurchase && (
                            <div>
                              <p className="text-gray-600">Purchase From</p>
                              <p className="font-medium text-gray-900">
                                {detail.countryOfPurchase}
                              </p>
                            </div>
                          )}
                          {detail.shipTo && (
                            <div className="col-span-2">
                              <p className="text-gray-600">Ship To</p>
                              <p className="font-medium text-gray-900">
                                {detail.shipTo}
                              </p>
                            </div>
                          )}
                          {detail.remarks && (
                            <div className="col-span-2">
                              <p className="text-gray-600">Remarks</p>
                              <p className="font-medium text-gray-900">
                                {detail.remarks}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Reference Images */}
                        {detail.imagePaths && detail.imagePaths.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-2">
                              Reference Images
                            </p>
                            <ImageGallery
                              images={detail.imagePaths}
                              alt={`${detail.productName} images`}
                              thumbnailSize="sm"
                            />
                          </div>
                        )}

                        {/* Procurement Response */}
                        {procResponse && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-green-900 mb-2 flex items-center">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Procurement Response
                            </h4>
                            {procResponse.combinations && Array.isArray(procResponse.combinations) && procResponse.combinations.length > 0 ? (
                              <div className="space-y-2">
                                {procResponse.combinations.map((combo: any, ci: number) => {
                                  const currency = combo.currency ?? "AED";
                                  return (
                                    <div key={ci} className="rounded border border-green-200 bg-white p-2 text-xs">
                                      <p className="font-medium text-green-900 mb-1">{combo.destinationCountry} · {combo.countryOfPurchase}{combo.shippingType || combo.movementType ? ` · Shipping: ${(combo.shippingType ?? "-").replace(/^./, (s: string) => s.toUpperCase())} · Movement: ${(combo.movementType ?? "-").replace(/^./, (s: string) => s.toUpperCase())}` : ""}</p>
                                      {combo.procurementImagePaths && Array.isArray(combo.procurementImagePaths) && combo.procurementImagePaths.length > 0 && (
                                        <div className="mb-2">
                                          <p className="text-[10px] text-gray-600 mb-1">Procurement Images</p>
                                          <ImageGallery
                                            images={combo.procurementImagePaths.map(toPublicUrl).filter(Boolean)}
                                            alt={`Combo ${ci + 1} images`}
                                            thumbnailSize="sm"
                                          />
                                        </div>
                                      )}
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div><span className="text-gray-600">Cost:</span> <span className="font-medium text-green-900">{combo.costPerUnit != null ? `${Number(combo.costPerUnit).toFixed(2)} ${currency}` : "-"}</span></div>
                                        <div><span className="text-gray-600">Freight:</span> <span className="font-medium text-green-900">{combo.freightCostPerUnit != null ? `${Number(combo.freightCostPerUnit).toFixed(2)} ${currency}` : "-"}</span></div>
                                        <div><span className="text-gray-600">Landed:</span> <span className="font-medium text-green-900">{combo.landedCostPerUnit != null ? `${Number(combo.landedCostPerUnit).toFixed(2)} ${currency}` : "-"}</span></div>
                                        {combo.etaDays != null && <div><span className="text-gray-600">ETA:</span> <span>{combo.etaDays} days</span></div>}
                                        {combo.remarks && <div className="col-span-3"><span className="text-gray-600">Remarks:</span> <span>{combo.remarks}</span></div>}
                                      </div>
                                    </div>
                                  );
                                })}
                                {procResponse.submittedAt && (
                                  <p className="text-[10px] text-gray-600 mt-1">Submitted {formatDate(procResponse.submittedAt)}</p>
                                )}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {procResponse.costPerUnit != null && (
                                  <div>
                                    <p className="text-gray-600">Cost/Unit</p>
                                    <p className="font-semibold text-green-900">{procResponse.costPerUnit}</p>
                                  </div>
                                )}
                                {procResponse.freightCostPerUnit != null && (
                                  <div>
                                    <p className="text-gray-600">Freight/Unit</p>
                                    <p className="font-semibold text-green-900">{procResponse.freightCostPerUnit}</p>
                                  </div>
                                )}
                                {procResponse.landedCostPerUnit != null && (
                                  <div>
                                    <p className="text-gray-600">Landed Cost/Unit</p>
                                    <p className="font-semibold text-green-900">{procResponse.landedCostPerUnit}</p>
                                  </div>
                                )}
                                {procResponse.etaDays != null && (
                                  <div>
                                    <p className="text-gray-600">ETA</p>
                                    <p className="font-semibold text-green-900">{procResponse.etaDays} days</p>
                                  </div>
                                )}
                                {procResponse.remarks && (
                                  <div className="col-span-2">
                                    <p className="text-gray-600">Remarks</p>
                                    <p className="font-medium text-green-900">{procResponse.remarks}</p>
                                  </div>
                                )}
                                {procResponse.submittedAt && (
                                  <div className="col-span-2">
                                    <p className="text-gray-600">Submitted</p>
                                    <p className="text-gray-900 text-xs">{formatDate(procResponse.submittedAt)}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Warehouse stock */}
                            {procResponse.warehouseStock && Array.isArray(procResponse.warehouseStock) && procResponse.warehouseStock.length > 0 && (
                              <div className="mt-3 border-t border-green-200 pt-2">
                                <p className="text-xs font-medium text-green-900 mb-2">Warehouse stock</p>
                                <div className="space-y-2">
                                  {procResponse.warehouseStock.map((row: any, ri: number) => (
                                    <div key={ri} className="rounded border border-green-100 bg-white p-2 text-xs">
                                      {row.procurementImagePaths && Array.isArray(row.procurementImagePaths) && row.procurementImagePaths.length > 0 && (
                                        <div className="mb-1">
                                          <ImageGallery
                                            images={row.procurementImagePaths.map(toPublicUrl).filter(Boolean)}
                                            alt={`Warehouse ${ri + 1} images`}
                                            thumbnailSize="sm"
                                          />
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-2">
                                        <span><span className="text-gray-600">Warehouse:</span> <span className="font-medium text-green-900">{row.warehouse ?? "-"}</span></span>
                                        <span><span className="text-gray-600">Qty:</span> <span>{row.qty != null ? Number(row.qty) : "-"}</span></span>
                                        <span><span className="text-gray-600">Cost/unit:</span> <span className="font-medium">{row.costPerUnit != null ? `${Number(row.costPerUnit).toFixed(2)} ${row.currency ?? "AED"}` : "-"}</span></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Legacy Procurement Images (only when no combinations) */}
                            {(!procResponse.combinations || procResponse.combinations.length === 0) &&
                              procResponse.procurementImagePaths &&
                              Array.isArray(procResponse.procurementImagePaths) &&
                              procResponse.procurementImagePaths.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-600 mb-2">Procurement Images</p>
                                  <ImageGallery
                                    images={procResponse.procurementImagePaths.map(toPublicUrl).filter(Boolean)}
                                    alt="Procurement images"
                                    thumbnailSize="sm"
                                  />
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 italic">
                No purchase details available
              </p>
            )}
          </div>
        </div>

        {/* General Remarks */}
        {qr.remarks && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              General Remarks
            </h3>
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
              {qr.remarks}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            {(creatorName || qr.created_by_email) && (
              <div>
                <p className="font-medium">Created By</p>
                <p>{creatorName ?? qr.created_by_email?.split("@")[0] ?? "-"}</p>
              </div>
            )}
            <div>
              <p className="font-medium">Created At</p>
              <p>{formatDateTime(qr.created_at)}</p>
            </div>
            <div>
              <p className="font-medium">Status</p>
              <p>{formatQrStatusLabel(qr.status)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
