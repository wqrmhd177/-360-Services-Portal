"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Qr } from "@/types/workflows";
import { formatQrStatusLabel } from "@/lib/format";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function getCurrencyForCountry(country: string): string {
  if (!country) return "AED";
  const countryLower = country.toLowerCase();
  if (countryLower.includes("saudi") || countryLower === "saudi arabia") return "SAR";
  if (countryLower.includes("pakistan") || countryLower === "pakistan") return "PKR";
  return "AED";
}

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

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

export default function SearchQrViewPage({ params }: { params: { id: string } }) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/growth/qr/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setQr(data);
        } else {
          setError("QR not found");
        }
      } catch {
        setError("Failed to load QR details");
      } finally {
        setLoading(false);
      }
    }
    load();
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
        if (data.names?.[qr.created_by_email]) setCreatorName(data.names[qr.created_by_email]);
        else setCreatorName(qr.created_by_email.split("@")[0]);
      })
      .catch(() => setCreatorName(qr.created_by_email?.split("@")[0] ?? null));
  }, [qr?.id, qr?.created_by_email]);

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
          <Link href="/dashboard" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const procurementResponse =
    qr.procurement_response && typeof qr.procurement_response === "object" ? qr.procurement_response : null;
  const metadata = procurementResponse ? (procurementResponse as Record<string, unknown>)._metadata : null;
  const editCount = (metadata as { editCount?: number } | null)?.editCount;
  const isReEdited = typeof editCount === "number" && editCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Quotation Request Details{" "}
            {qr.qr_number && <span className="text-lg font-mono text-gray-600">({qr.qr_number})</span>}
          </h2>
          {isReEdited && (
            <div className="mt-2">
              <span className="badge border-yellow-500 bg-yellow-50 text-yellow-700 text-xs font-semibold">
                Re-edited by Procurement
              </span>
            </div>
          )}
        </div>
        <Link href="/dashboard" className="text-xs font-medium text-gray-900 hover:text-gray-700">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Customer Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Customer Name / Code</label>
            <div className="text-sm font-medium text-gray-900">{qr.reseller_code}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Customer Contact No.</label>
            <div className="text-sm font-medium text-gray-900">{qr.reseller_contact_no || "-"}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Customer Country</label>
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

      {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0 && (
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Purchase Details</h3>
          <div className="space-y-4">
            {qr.purchase_details.map((detail: Record<string, unknown>, index: number) => {
              const response = (procurementResponse as Record<number, unknown>)?.[index] as Record<string, unknown> | undefined;
              const isItemReEdited =
                response?.lastEditedAt && response?.lastEditedAt !== response?.submittedAt;
              return (
                <div
                  key={index}
                  className={`rounded-xl border p-4 ${
                    isItemReEdited ? "border-yellow-300 bg-yellow-50/50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="grid gap-4 md:grid-cols-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-500 uppercase">Product Name</label>
                      <div className="text-sm font-semibold text-gray-900">{(detail.productName as string) || "-"}</div>
                    </div>
                    {(detail.destinationCountries as string[])?.length || detail.destinationCountry ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Destination Country(ies)</label>
                        <div className="text-sm font-medium text-gray-900">
                          {(detail.destinationCountries as string[])?.length
                            ? (detail.destinationCountries as string[]).join(", ")
                            : (detail.destinationCountry as string)}
                        </div>
                      </div>
                    ) : null}
                    {detail.countryOfPurchase != null && detail.countryOfPurchase !== "" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Country of Purchase</label>
                        <div className="text-sm font-medium text-gray-900">{detail.countryOfPurchase as string}</div>
                      </div>
                    )}
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-medium text-gray-500 uppercase">Quantity & Target Price</label>
                      <div className="text-sm font-medium text-gray-900">
                        {detail.countryDetails && Array.isArray(detail.countryDetails) && detail.countryDetails.length > 0
                          ? (detail.countryDetails as {
                              country: string;
                              quantity: number;
                              targetPrice: number;
                              currency?: "AED" | "SAR" | "PKR";
                            }[]).map((cd) => (
                              <div key={cd.country} className="text-xs">
                                {cd.country}: {cd.quantity} units · Target{" "}
                                {formatTargetPrice(cd.targetPrice, cd.country, cd.currency)}
                              </div>
                            ))
                          : (() => {
                              const countries: string[] = (detail.destinationCountries as string[])?.length ? (detail.destinationCountries as string[]) : (detail.destinationCountry ? [String(detail.destinationCountry)] : []);
                              return countries.length > 0
                                ? countries.map((c: string) => (
                                    <div key={c} className="text-xs">
                                      {c}: {Number(detail.quantity) || 0} units · Target {formatTargetPrice(detail.targetPrice as number | undefined, c)}
                                    </div>
                                  ))
                                : (
                                    <span className="text-xs">{Number(detail.quantity) || 0} units · Target {formatTargetPrice(detail.targetPrice as number | undefined, String(detail.destinationCountry || ""))}</span>
                                  );
                            })()}
                      </div>
                    </div>
                  </div>
                  {response && (
                    <div
                      className={`mt-4 rounded-lg border p-3 ${
                        isItemReEdited ? "border-yellow-400 bg-yellow-100/50" : "border-gray-300 bg-white"
                      }`}
                    >
                      <div className="text-xs font-semibold text-gray-900 mb-2">Procurement Response</div>
                      <div className="grid gap-2 md:grid-cols-3 text-xs">
                        <div>
                          <span className="text-gray-500">Cost per Unit:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {(response.costPerUnit as number)?.toFixed(2) || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Freight Cost per Unit:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {(response.freightCostPerUnit as number)?.toFixed(2) || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Landed Cost per Unit:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {(response.landedCostPerUnit as number)?.toFixed(2) || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {Array.isArray(detail.imagePaths) && (detail.imagePaths as string[]).length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <label className="text-[10px] font-medium text-gray-500 uppercase">Reference Images</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(detail.imagePaths as string[]).map((imagePath: string, imgIndex: number) => {
                          const imageUrl = imagePath.startsWith("http")
                            ? imagePath
                            : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                          return (
                            <div key={imgIndex} className="relative group">
                              <img
                                src={imageUrl}
                                alt={`Image ${imgIndex + 1}`}
                                className="h-32 w-full rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-90"
                                onClick={() => window.open(imageUrl, "_blank")}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    </div>
  );
}
