"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Qr } from "@/types/workflows";
import { isZambeelLikeService } from "@/lib/serviceTypes";
import { createSupabaseClient } from "@/lib/supabaseClient";
import SkuSearchInput from "@/components/SkuSearchInput";
import type { InventorySku } from "@/lib/metabaseInventory";

// Get Supabase URL from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uengcejyjagdcqecnlkr.supabase.co";

// Helper to sanitize file names
function sanitizeFileName(name: string): string {
  return (name || "file")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_");
}

// Helper to get currency by country (same logic as Growth)
function getCurrencyForCountry(country: string): string {
  if (!country) return "AED";
  const countryLower = country.toLowerCase();
  if (countryLower.includes("saudi") || countryLower === "saudi arabia" || countryLower.includes("ksa")) {
    return "SAR";
  }
  if (countryLower.includes("pakistan") || countryLower === "pakistan") {
    return "PKR";
  }
  return "AED";
}

interface PurchaseDetail {
  productName?: string;
  destinationCountry?: string;
  destinationCountries?: string[];
  countryOfPurchase?: "China" | "Local Market";
  shippingType?: string;
  movementType?: string;
  quantity: number;
  targetPrice?: number;
  costPerUnit?: number;
  freightCostPerUnit?: number;
  landedCostPerUnit?: number;
  etaDays?: number;
  remarks?: string;
  procurementImages?: File[];
  procurementImagePreviews?: string[];
  procurementImagePaths?: string[];
}

type CurrencyCode = "AED" | "SAR" | "PKR";

interface CombinationRow {
  destinationCountry: string;
  countryOfPurchase: "China" | "Local Market";
  shippingType: string;
  movementType: string;
  currency?: CurrencyCode;
  costPerUnit: number;
  freightCostPerUnit: number;
  landedCostPerUnit: number;
  etaDays?: number | null;
  remarks: string;
  procurementImagePaths?: string[];
}

interface WarehouseStockRow {
  sku: string;
  country: string;
  qty: number;
  costPerUnit: number;
  currency?: CurrencyCode;
  procurementImagePaths?: string[];
  procurementImagePreviews?: string[];
}

export default function ProcurementQrRespondPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [qr, setQr] = useState<Qr | null>(null);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
  /** Per-detail combination rows (Country × Purchase From × Shipping × Movement + costs). */
  const [combinationRows, setCombinationRows] = useState<Record<number, CombinationRow[]>>({});
  /** Per-detail warehouse stock rows (Warehouse + Qty + Cost per unit + currency + images). */
  const [warehouseStockByDetail, setWarehouseStockByDetail] = useState<
    Record<number, WarehouseStockRow[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  /** Per combination row image previews (key: `${detailIndex}-${rowIndex}`). */
  const [combinationImagePreviews, setCombinationImagePreviews] = useState<Record<string, string[]>>({});

  const procurementImageFilesRef = useRef<Map<number, File[]>>(new Map());
  const combinationImageFilesRef = useRef<Map<string, File[]>>(new Map());
  const warehouseImageFilesRef = useRef<Map<string, File[]>>(new Map());

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
      const res = await fetch(`/api/procurement/qr/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setQr(data);
        if (data.purchase_details && Array.isArray(data.purchase_details)) {
          // Pre-populate with saved procurement responses if they exist
          const procurementResponse = data.procurement_response && typeof data.procurement_response === "object"
            ? data.procurement_response
            : data.procurement_response && typeof data.procurement_response === "string"
            ? (() => {
                try {
                  return JSON.parse(data.procurement_response);
                } catch {
                  return {};
                }
              })()
            : {};
          
          const populatedDetails = data.purchase_details.map((detail: any, index: number) => {
            const savedResponse = procurementResponse[index];
            if (savedResponse && savedResponse.costPerUnit !== undefined) {
              return {
                ...detail,
                costPerUnit: savedResponse.costPerUnit,
                freightCostPerUnit: savedResponse.freightCostPerUnit,
                landedCostPerUnit: savedResponse.landedCostPerUnit,
                etaDays: savedResponse.etaDays ?? detail.etaDays ?? undefined,
                remarks: savedResponse.remarks || "",
                procurementImagePaths: Array.isArray(savedResponse.procurementImagePaths)
                  ? savedResponse.procurementImagePaths
                  : [],
                procurementImages: [],
                procurementImagePreviews: []
              };
            }
            return {
              ...detail,
              etaDays: detail.etaDays ?? undefined,
              remarks: detail.remarks || "",
              procurementImagePaths: [],
              procurementImages: [],
              procurementImagePreviews: []
            };
          });

          setPurchaseDetails(populatedDetails);

          const combos: Record<number, CombinationRow[]> = {};
          data.purchase_details.forEach((detail: any, index: number) => {
            const saved = procurementResponse[index];
            const countries = (detail.destinationCountries && detail.destinationCountries.length > 0)
              ? detail.destinationCountries
              : (detail.destinationCountry ? [detail.destinationCountry] : []);
            if (saved && Array.isArray(saved.combinations) && saved.combinations.length > 0) {
              combos[index] = saved.combinations.map((c: any) => ({
                destinationCountry: c.destinationCountry ?? "",
                countryOfPurchase: c.countryOfPurchase ?? "China",
                shippingType: c.shippingType ?? "sea",
                movementType: c.movementType ?? "normal",
                currency: (c.currency === "AED" || c.currency === "SAR" || c.currency === "PKR" ? c.currency : undefined) ?? (getCurrencyForCountry(c.destinationCountry ?? "") as CurrencyCode),
                costPerUnit: Number(c.costPerUnit ?? 0),
                freightCostPerUnit: Number(c.freightCostPerUnit ?? 0),
                landedCostPerUnit: Number(c.landedCostPerUnit ?? 0),
                etaDays: c.etaDays ?? null,
                remarks: c.remarks ?? "",
                procurementImagePaths: c.procurementImagePaths ?? []
              }));
            } else if (saved && saved.costPerUnit !== undefined) {
              combos[index] = [{
                destinationCountry: detail.destinationCountry || countries[0] || "",
                countryOfPurchase: detail.countryOfPurchase ?? "China",
                shippingType: detail.shippingType ?? "sea",
                movementType: detail.movementType ?? "normal",
                currency: (saved.currency === "AED" || saved.currency === "SAR" || saved.currency === "PKR" ? saved.currency : undefined) ?? (getCurrencyForCountry(detail.destinationCountry || countries[0] || "") as CurrencyCode),
                costPerUnit: Number(saved.costPerUnit),
                freightCostPerUnit: Number(saved.freightCostPerUnit),
                landedCostPerUnit: Number(saved.landedCostPerUnit),
                etaDays: saved.etaDays ?? null,
                remarks: saved.remarks ?? "",
                procurementImagePaths: saved.procurementImagePaths ?? []
              }];
            } else {
              const isSourcingService =
                isZambeelLikeService(data.service_needed ?? "") ||
                data.service_needed === "Sourcing & Logistics" ||
                data.service_needed === "Sourcing only";
              const firstCountry = detail.destinationCountry || countries[0] || "";
              const defaultRow: CombinationRow = {
                destinationCountry: firstCountry,
                countryOfPurchase: (detail.countryOfPurchase as "China" | "Local Market") ?? "China",
                shippingType: detail.shippingType ?? "sea",
                movementType: detail.movementType ?? "normal",
                currency: getCurrencyForCountry(firstCountry) as CurrencyCode,
                costPerUnit: 0,
                freightCostPerUnit: 0,
                landedCostPerUnit: 0,
                etaDays: null,
                remarks: "",
                procurementImagePaths: []
              };
              if (countries.length === 0) {
                combos[index] = [defaultRow];
              } else if (isSourcingService) {
                // Sourcing services: always show combinations so Purchaser can set P/S/M per product
                combos[index] = [defaultRow];
              } else {
                combos[index] = [];
              }
            }
          });
          setCombinationRows(combos);

          const ws: Record<number, WarehouseStockRow[]> = {};
          data.purchase_details.forEach((_: any, index: number) => {
            const saved = procurementResponse[index];
            const arr: WarehouseStockRow[] =
              Array.isArray(saved?.warehouseStock) && saved.warehouseStock.length > 0
                ? saved.warehouseStock.map((e: any) => ({
                    sku: e.sku ?? e.warehouse ?? "",
                    country: e.country ?? e.warehouse ?? "",
                    qty: Number(e.qty) || 0,
                    costPerUnit: Number(e.costPerUnit) || 0,
                    currency: (e.currency === "AED" || e.currency === "SAR" || e.currency === "PKR" ? e.currency : undefined) ?? ("AED" as CurrencyCode),
                    procurementImagePaths: Array.isArray(e.procurementImagePaths) ? e.procurementImagePaths : []
                  }))
                : [{ sku: "", country: "", qty: 0, costPerUnit: 0 }];
            ws[index] = arr;
          });
          setWarehouseStockByDetail(ws);
        }
      }
    } catch (error) {
      console.error("Failed to load QR:", error);
    } finally {
      setLoading(false);
    }
  }

  function updateCost(index: number, field: "costPerUnit" | "freightCostPerUnit", value: number) {
    const updated = [...purchaseDetails];
    const row = { ...updated[index], [field]: value };
    const cost = field === "costPerUnit" ? value : (row.costPerUnit ?? 0);
    const freight = field === "freightCostPerUnit" ? value : (row.freightCostPerUnit ?? 0);
    row.landedCostPerUnit = parseFloat((cost + freight).toFixed(2));
    updated[index] = row;
    setPurchaseDetails(updated);
  }

  function updateRemarks(index: number, value: string) {
    const updated = [...purchaseDetails];
    updated[index] = { ...updated[index], remarks: value };
    setPurchaseDetails(updated);
  }
  function updateEtaDays(index: number, value: number) {
    const updated = [...purchaseDetails];
    updated[index] = { ...updated[index], etaDays: value };
    setPurchaseDetails(updated);
  }

  function getDetailCountries(detail: PurchaseDetail): string[] {
    if (detail.destinationCountries && detail.destinationCountries.length > 0) {
      return detail.destinationCountries;
    }
    return detail.destinationCountry ? [detail.destinationCountry] : [];
  }

  function addCombination(detailIndex: number) {
    const detail = purchaseDetails[detailIndex];
    const countries = getDetailCountries(detail);
    const firstCountry = countries[0] || "";
    const newRow: CombinationRow = {
      destinationCountry: firstCountry,
      countryOfPurchase: "China",
      shippingType: "sea",
      movementType: "normal",
      currency: getCurrencyForCountry(firstCountry) as CurrencyCode,
      costPerUnit: 0,
      freightCostPerUnit: 0,
      landedCostPerUnit: 0,
      etaDays: null,
      remarks: "",
      procurementImagePaths: []
    };
    setCombinationRows((prev) => ({
      ...prev,
      [detailIndex]: [...(prev[detailIndex] || []), newRow]
    }));
  }

  function updateCombination(
    detailIndex: number,
    rowIndex: number,
    field: keyof CombinationRow,
    value: string | number | null | string[] | CurrencyCode
  ) {
    setCombinationRows((prev) => {
      const rows = [...(prev[detailIndex] || [])];
      const row = { ...rows[rowIndex], [field]: value };
      if (field === "costPerUnit" || field === "freightCostPerUnit") {
        const cost = field === "costPerUnit" ? Number(value) : (row.costPerUnit ?? 0);
        const freight = field === "freightCostPerUnit" ? Number(value) : (row.freightCostPerUnit ?? 0);
        row.landedCostPerUnit = parseFloat((cost + freight).toFixed(2));
      }
      rows[rowIndex] = row;
      return { ...prev, [detailIndex]: rows };
    });
  }

  function removeCombination(detailIndex: number, rowIndex: number) {
    setCombinationRows((prev) => {
      const rows = (prev[detailIndex] || []).filter((_, i) => i !== rowIndex);
      return { ...prev, [detailIndex]: rows };
    });
  }

  function addWarehouseStockRow(detailIndex: number) {
    setWarehouseStockByDetail((prev) => ({
      ...prev,
      [detailIndex]: [...(prev[detailIndex] || []), { sku: "", country: "", qty: 0, costPerUnit: 0, currency: "AED" as CurrencyCode }]
    }));
  }

  function removeWarehouseStockRow(detailIndex: number, rowIndex: number) {
    const key = `${detailIndex}-wh-${rowIndex}`;
    warehouseImageFilesRef.current.delete(key);
    setWarehouseStockByDetail((prev) => {
      const rows = (prev[detailIndex] || []).filter((_, i) => i !== rowIndex);
      return { ...prev, [detailIndex]: rows.length > 0 ? rows : [{ sku: "", country: "", qty: 0, costPerUnit: 0, currency: "AED" as CurrencyCode }] };
    });
  }

  function updateWarehouseStock(
    detailIndex: number,
    rowIndex: number,
    field: keyof WarehouseStockRow,
    value: string | number | string[] | undefined
  ) {
    setWarehouseStockByDetail((prev) => {
      const rows = [...(prev[detailIndex] || [])];
      const row: WarehouseStockRow = rows[rowIndex] || { sku: "", country: "", qty: 0, costPerUnit: 0 };
      rows[rowIndex] = { ...row, [field]: value as any };
      return { ...prev, [detailIndex]: rows };
    });
  }

  function handleCombinationImageChange(detailIndex: number, rowIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const key = `${detailIndex}-${rowIndex}`;
    const current = combinationImageFilesRef.current.get(key) || [];
    combinationImageFilesRef.current.set(key, [...current, ...files]);
    setCombinationImagePreviews((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), ...files.map((f) => URL.createObjectURL(f))]
    }));
    e.target.value = "";
  }

  function handleWarehouseImageChange(detailIndex: number, rowIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const key = `${detailIndex}-wh-${rowIndex}`;
    const current = warehouseImageFilesRef.current.get(key) || [];
    warehouseImageFilesRef.current.set(key, [...current, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setWarehouseStockByDetail((prev) => {
      const rows = [...(prev[detailIndex] || [])];
      const row = rows[rowIndex] || { warehouse: "", qty: 0, costPerUnit: 0 };
      rows[rowIndex] = { ...row, procurementImagePreviews: [...(row.procurementImagePreviews || []), ...newPreviews] };
      return { ...prev, [detailIndex]: rows };
    });
    e.target.value = "";
  }

  function handleProcurementImageChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentFiles = procurementImageFilesRef.current.get(index) || [];
    const newFiles = [...currentFiles, ...files];
    procurementImageFilesRef.current.set(index, newFiles);

    const updated = [...purchaseDetails];
    const detail = updated[index] || ({} as PurchaseDetail);

    const newPreviews = [
      ...(detail.procurementImagePreviews || []),
      ...files.map((file) => URL.createObjectURL(file))
    ];

    updated[index] = {
      ...detail,
      procurementImages: newFiles,
      procurementImagePreviews: newPreviews
    };

    setPurchaseDetails(updated);
  }

  async function submitCombination(index: number, isSubmitted: boolean) {
    const detail = purchaseDetails[index];
    const countries = getDetailCountries(detail);
    const isSourcingService =
      isZambeelLikeService(qr?.service_needed ?? "") ||
      qr?.service_needed === "Sourcing & Logistics" ||
      qr?.service_needed === "Sourcing only";
    const useCombinations =
      isSourcingService ||
      countries.length > 1 ||
      (combinationRows[index] && combinationRows[index].length > 0);

    if (useCombinations) {
      const rows = combinationRows[index] || [];
      const valid = rows.filter(
        (r) =>
          r.costPerUnit != null &&
          r.freightCostPerUnit != null &&
          r.destinationCountry
      );
      if (valid.length === 0) {
        setError("Add at least one combination with destination country and all cost fields.");
        return;
      }
      if (!isSubmitted && valid.length !== rows.length) {
        setError("Each combination must have destination country, cost per unit, and freight per unit.");
        return;
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const key = `${index}-${i}`;
        const hasNewImages = (combinationImageFilesRef.current.get(key) || []).length > 0;
        const hasSavedImages = (r.procurementImagePaths?.length ?? 0) > 0;
        if (!hasNewImages && !hasSavedImages) {
          setError(`Procurement images are required for combination ${i + 1}.`);
          return;
        }
      }
    } else {
      if (
        !isSubmitted &&
        (!detail.costPerUnit || !detail.freightCostPerUnit)
      ) {
        setError("Please fill in Cost per Unit and Freight Cost per Unit");
        return;
      }
      const hasNewImages = (procurementImageFilesRef.current.get(index) || []).length > 0;
      const hasSavedImages = (detail.procurementImagePaths?.length ?? 0) > 0;
      if (!hasNewImages && !hasSavedImages) {
        setError("Procurement images are required.");
        return;
      }
    }

    const whRows = warehouseStockByDetail[index] || [];
    for (let i = 0; i < whRows.length; i++) {
      const r = whRows[i];
      if (!r.sku?.trim()) continue;
      const key = `${index}-wh-${i}`;
      const hasNewImages = (warehouseImageFilesRef.current.get(key) || []).length > 0;
      const hasSavedImages = (r.procurementImagePaths?.length ?? 0) > 0;
      if (!hasNewImages && !hasSavedImages) {
        setError(`Procurement images are required for warehouse SKU row ${i + 1}.`);
        return;
      }
    }

    setSubmitting(index);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const filesFromRef = procurementImageFilesRef.current.get(index) || [];
      const newImagePaths: string[] = [];

      if (filesFromRef.length > 0) {
        for (const image of filesFromRef) {
          const safeName = sanitizeFileName(image.name || "image.png");
          const fileName = `procurement-images/${Date.now()}-${Math.random()
            .toString(36)
            .substring(7)}-${safeName}`;
          const { data, error } = await supabase.storage
            .from("qr-attachments")
            .upload(fileName, image, {
              cacheControl: "3600",
              upsert: false
            });
          if (!error && data?.path) newImagePaths.push(data.path);
        }
      }

      async function uploadFiles(files: File[]): Promise<string[]> {
        const paths: string[] = [];
        for (const image of files) {
          const safeName = sanitizeFileName(image.name || "image.png");
          const fileName = `procurement-images/${Date.now()}-${Math.random().toString(36).substring(7)}-${safeName}`;
          const { data, error } = await supabase.storage.from("qr-attachments").upload(fileName, image, { cacheControl: "3600", upsert: false });
          if (!error && data?.path) paths.push(data.path);
        }
        return paths;
      }

      const allWhRows = warehouseStockByDetail[index] || [];
      const warehouseStockPayload: {
        sku: string;
        country: string;
        qty: number;
        costPerUnit: number;
        currency?: CurrencyCode;
        procurementImagePaths?: string[];
      }[] = [];
      for (let rowIndex = 0; rowIndex < allWhRows.length; rowIndex++) {
        const r = allWhRows[rowIndex];
        if (!r.sku?.trim()) continue;
        const key = `${index}-wh-${rowIndex}`;
        const whFiles = warehouseImageFilesRef.current.get(key) || [];
        const uploaded = whFiles.length > 0 ? await uploadFiles(whFiles) : [];
        const allPaths = [...(r.procurementImagePaths || []), ...uploaded];
        warehouseStockPayload.push({
          sku: r.sku.trim(),
          country: r.country || "",
          qty: Number(r.qty) || 0,
          costPerUnit: Number(r.costPerUnit) || 0,
          currency: r.currency,
          procurementImagePaths: allPaths
        });
      }

      let body: Record<string, unknown>;
      if (useCombinations && (combinationRows[index]?.length ?? 0) > 0) {
        const rowsWithImages = await Promise.all(
          (combinationRows[index] || []).map(async (r, rowIndex) => {
            const key = `${index}-${rowIndex}`;
            const rowFiles = combinationImageFilesRef.current.get(key) || [];
            const uploaded = rowFiles.length > 0 ? await uploadFiles(rowFiles) : [];
            const allPaths = [...(r.procurementImagePaths || []), ...uploaded];
            return {
              destinationCountry: r.destinationCountry,
              countryOfPurchase: r.countryOfPurchase,
              shippingType: r.shippingType,
              movementType: r.movementType,
              currency: r.currency,
              costPerUnit: r.costPerUnit,
              freightCostPerUnit: r.freightCostPerUnit,
              landedCostPerUnit: r.landedCostPerUnit,
              etaDays: r.etaDays ?? null,
              remarks: r.remarks ?? "",
              procurementImagePaths: allPaths
            };
          })
        );
        body = { purchaseDetailIndex: index, combinations: rowsWithImages, warehouseStock: warehouseStockPayload };
        combinationImageFilesRef.current.forEach((_, key) => { if (key.startsWith(`${index}-`) && !key.startsWith(`${index}-wh-`)) combinationImageFilesRef.current.delete(key); });
        warehouseImageFilesRef.current.forEach((_, key) => { if (key.startsWith(`${index}-wh-`)) warehouseImageFilesRef.current.delete(key); });
        setCombinationImagePreviews((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => { if (k.startsWith(`${index}-`) && !k.startsWith(`${index}-wh-`)) delete next[k]; });
          return next;
        });
        setWarehouseStockByDetail((prev) => {
          const rows = (prev[index] || []).map((r) => ({ ...r, procurementImagePreviews: [] }));
          return { ...prev, [index]: rows };
        });
      } else {
        body = {
          purchaseDetailIndex: index,
          costPerUnit: detail.costPerUnit,
          freightCostPerUnit: detail.freightCostPerUnit,
          landedCostPerUnit: detail.landedCostPerUnit,
          etaDays: detail.etaDays ?? null,
          procurementImagePaths: newImagePaths,
          remarks: detail.remarks || "",
          warehouseStock: warehouseStockPayload
        };
      }

      const res = await fetch(`/api/procurement/qr/${params.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to submit costs");
        setSubmitting(null);
        return;
      }

      const updated = [...purchaseDetails];
      updated[index] = {
        ...updated[index],
        procurementImages: [],
        procurementImagePreviews: []
      };
      procurementImageFilesRef.current.set(index, []);
      setPurchaseDetails(updated);

      await loadQr();
      setSubmitting(null);
    } catch (err) {
      setError("Unexpected error, please try again.");
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-700">Loading...</p>
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="card">
        <p className="text-sm text-gray-700">QR not found.</p>
        <Link
          href="/dashboard/procurement"
          className="mt-4 text-xs text-gray-900 font-medium hover:text-gray-700"
        >
          ← Back to Procurement Dashboard
        </Link>
      </div>
    );
  }

  // Allow editing even if status is "responded" - Procurement can re-edit submitted QRs

  const procurementResponse =
    qr.procurement_response && typeof qr.procurement_response === "object"
      ? qr.procurement_response
      : qr.procurement_response && typeof qr.procurement_response === "string"
      ? (() => {
          try {
            return JSON.parse(qr.procurement_response);
          } catch {
            return {};
          }
        })()
      : {};

  const metadata = (procurementResponse as any)?._metadata;
  const hasBeenEdited = metadata && metadata.editCount > 0;
  const detailIsSubmitted = (idx: number) => {
    const r = procurementResponse[idx];
    if (!r) return false;
    if (r.combinations && Array.isArray(r.combinations) && r.combinations.length > 0) return true;
    return r.costPerUnit !== undefined;
  };
  const allSubmitted = qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.every((_: any, idx: number) => detailIsSubmitted(idx));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Respond to Quotation Request</h2>
            {qr.qr_number && (
              <span className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm font-mono font-semibold text-gray-900">
                {qr.qr_number}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Fill in cost details for each purchase detail combination.
          </p>
        </div>
        <Link href="/dashboard/procurement" className="text-xs text-gray-700 font-medium hover:text-gray-900">
          ← Back
        </Link>
      </div>

      <div className="card py-3 px-4">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">QR Details (Read-Only)</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
          <span><span className="text-gray-500">Code:</span> <span className="font-medium text-gray-900">{qr.reseller_code}</span></span>
          <span><span className="text-gray-500">Contact:</span> <span className="font-medium text-gray-900">{qr.reseller_contact_no || "-"}</span></span>
          <span><span className="text-gray-500">Country:</span> <span className="font-medium text-gray-900">{qr.reseller_country || "-"}</span></span>
          <span><span className="text-gray-500">Service:</span> <span className="font-medium text-gray-900">{qr.service_needed || "-"}</span></span>
          {(creatorName || qr.created_by_email) && (
            <span><span className="text-gray-500">Created by:</span> <span className="font-medium text-gray-900">{creatorName ?? qr.created_by_email?.split("@")[0] ?? "-"}</span></span>
          )}
          {qr.created_at && (
            <span><span className="text-gray-500">Created at:</span> <span className="font-medium text-gray-900">{new Date(qr.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></span>
          )}
        </div>
        {qr.remarks && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-gray-500 text-xs">Remarks:</span> <span className="text-xs text-gray-900">{qr.remarks}</span>
          </div>
        )}

        {/* Display Images from Purchase Details */}
        {qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
            <h4 className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Reference Images</h4>
            {qr.purchase_details.map((detail: any, detailIndex: number) => {
              const imagePaths = detail.imagePaths || [];
              if (!imagePaths || imagePaths.length === 0) return null;

              return (
                <div key={detailIndex} className="space-y-2">
                  <div className="text-[10px] font-medium text-gray-600">
                    {detail.productName} - {(detail.destinationCountries && detail.destinationCountries.length > 0) ? detail.destinationCountries.join(", ") : (detail.destinationCountry || "-")}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {imagePaths.map((imagePath: string, imgIndex: number) => {
                      // Construct Supabase Storage URL
                      let imageUrl = imagePath;
                      
                      if (!imagePath.startsWith("http")) {
                        // Images are stored in qr-attachments bucket with path like: qr-images/filename.png
                        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                      }
                      
                      return (
                        <div key={imgIndex} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`${detail.productName} - Image ${imgIndex + 1}`}
                            className="h-32 w-full rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                            onError={(e) => {
                              // Try alternative bucket names if first fails
                              const target = e.target as HTMLImageElement;
                              const path = imagePath.includes("/") ? imagePath.split("/").pop() : imagePath;
                              const buckets = ["qr-images", "qr-references", "images", "public"];
                              const currentSrc = target.src;
                              const currentBucket = buckets.find(b => currentSrc.includes(`/${b}/`));
                              const nextBucketIndex = currentBucket ? buckets.indexOf(currentBucket) + 1 : 0;
                              
                              if (nextBucketIndex < buckets.length && path) {
                                target.src = `${SUPABASE_URL}/storage/v1/object/public/${buckets[nextBucketIndex]}/${path}`;
                              } else {
                                // Final fallback - show placeholder
                                target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='14' dy='10.5' x='50%25' y='50%25' text-anchor='middle'%3EImage%3C/text%3E%3C/svg%3E`;
                                target.onerror = null; // Prevent infinite loop
                              }
                            }}
                            onClick={() => {
                              // Open image in new tab on click for full view
                              window.open(imageUrl, "_blank");
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Purchase Details - Cost Entry</h3>
          {hasBeenEdited && (
            <span className="badge border-yellow-500 bg-yellow-50 text-yellow-700 text-xs font-semibold">
              ⚠️ Re-editing submitted QR
            </span>
          )}
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {hasBeenEdited && (
          <div className="mb-4 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-700">
            <strong>Note:</strong> This QR has been previously submitted. Any changes you make will be tracked and notified to the Growth team.
            {metadata.lastEditedAt && (
              <div className="mt-1">
                Last edited: {new Date(metadata.lastEditedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
        <div className="space-y-4">
          {purchaseDetails.map((detail, index) => {
            const savedResponse = procurementResponse[index];
            const isSubmitted = savedResponse && (savedResponse.combinations?.length > 0 || savedResponse.costPerUnit !== undefined);
            const isItemReEdited = savedResponse?.lastEditedAt && savedResponse?.lastEditedAt !== savedResponse?.submittedAt;
            const countries = getDetailCountries(detail);
            const isSourcingService =
              isZambeelLikeService(qr?.service_needed ?? "") ||
              qr?.service_needed === "Sourcing & Logistics" ||
              qr?.service_needed === "Sourcing only";
            const useCombinations =
              isSourcingService ||
              countries.length > 1 ||
              (combinationRows[index] && combinationRows[index].length > 0);
            const rows = combinationRows[index] || [];
            const currentCostPerUnit = detail.costPerUnit ?? savedResponse?.costPerUnit ?? "";
            const currentFreightCostPerUnit = detail.freightCostPerUnit ?? savedResponse?.freightCostPerUnit ?? "";
            const currentLandedCostPerUnit = detail.landedCostPerUnit ?? savedResponse?.landedCostPerUnit ?? "";
            const currentEtaDays = detail.etaDays ?? savedResponse?.etaDays ?? "";
            const currentRemarks = detail.remarks || savedResponse?.remarks || "";

            return (
              <div
                key={index}
                className={`rounded-2xl border p-4 shadow-soft ${
                  isSubmitted
                    ? isItemReEdited
                      ? "border-yellow-300 bg-yellow-50/30"
                      : "border-green-200 bg-green-50/30"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="mb-3 grid gap-3 text-xs md:grid-cols-8">
                  <div>
                    <span className="text-gray-500">Product:</span>
                    <div className="font-medium text-gray-900">{detail.productName || "-"}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Destination(s):</span>
                    <div className="font-medium text-gray-900">
                      {countries.length > 0 ? countries.join(", ") : (detail.destinationCountry || "-")}
                    </div>
                  </div>
                  {!useCombinations && (
                    <div>
                      <span className="text-gray-500">Purchase From:</span>
                      <div className="font-medium text-gray-900">{detail.countryOfPurchase ?? "-"}</div>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Quantity & Target Price:</span>
                    <div className="font-medium text-gray-900 mt-0.5">
                      {(detail as any).countryDetails && Array.isArray((detail as any).countryDetails) && (detail as any).countryDetails.length > 0
                        ? (detail as any).countryDetails.map((cd: { country: string; quantity: number; targetPrice: number }) => (
                            <div key={cd.country} className="text-xs">
                              {cd.country}: {cd.quantity} units, Target {Number(cd.targetPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {getCurrencyForCountry(cd.country)}
                            </div>
                          ))
                        : countries.length > 0
                          ? countries.map((c) => (
                              <div key={c} className="text-xs">
                                {c}: {detail.quantity} units, Target {detail.targetPrice !== undefined && detail.targetPrice !== null ? `${Number(detail.targetPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getCurrencyForCountry(c)}` : "-"}
                              </div>
                            ))
                          : (
                              <span>
                                {detail.quantity} units{detail.targetPrice !== undefined && detail.targetPrice !== null ? `, Target ${Number(detail.targetPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getCurrencyForCountry(detail.destinationCountry || "")}` : ""}
                              </span>
                            )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    {isSubmitted && (
                      <span className={`badge ${isItemReEdited ? "border-yellow-500 bg-yellow-50 text-yellow-700" : "border-green-500 bg-green-50 text-green-700"}`}>
                        {isItemReEdited ? "Updated" : "Submitted"}
                      </span>
                    )}
                  </div>
                </div>

                {useCombinations ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Combinations (Country × Purchase From × Shipping × Movement)</span>
                      <button
                        type="button"
                        onClick={() => addCombination(index)}
                        className="text-xs font-medium text-gray-900 hover:text-gray-700"
                      >
                        + Add combination
                      </button>
                    </div>
                    {rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                        <div className="grid gap-2 text-xs md:grid-cols-[1fr,0.8fr,0.7fr,0.7fr,0.6fr,0.8fr,0.8fr,0.8fr,auto]">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Country</label>
                            <select
                              value={row.destinationCountry}
                              onChange={(e) => updateCombination(index, rowIndex, "destinationCountry", e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                            >
                              {countries.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Purchase From</label>
                            <select
                              value={row.countryOfPurchase}
                              onChange={(e) => updateCombination(index, rowIndex, "countryOfPurchase", e.target.value as "China" | "Local Market")}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                            >
                              <option value="China">China</option>
                              <option value="Local Market">Local Market</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Shipping</label>
                            <select
                              value={row.shippingType}
                              onChange={(e) => updateCombination(index, rowIndex, "shippingType", e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                            >
                              <option value="sea">Sea</option>
                              <option value="air">Air</option>
                              <option value="road">Road</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Movement</label>
                            <select
                              value={row.movementType}
                              onChange={(e) => updateCombination(index, rowIndex, "movementType", e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                            >
                              <option value="normal">Normal</option>
                              <option value="express">Express</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Currency</label>
                            <select
                              value={row.currency ?? getCurrencyForCountry(row.destinationCountry)}
                              onChange={(e) => updateCombination(index, rowIndex, "currency", e.target.value as CurrencyCode)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                            >
                              <option value="AED">AED</option>
                              <option value="SAR">SAR</option>
                              <option value="PKR">PKR</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Cost/Unit ({(row.currency ?? getCurrencyForCountry(row.destinationCountry))}) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={row.costPerUnit || ""}
                              onChange={(e) => updateCombination(index, rowIndex, "costPerUnit", Number(e.target.value) || 0)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Freight/Unit *</label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={row.freightCostPerUnit || ""}
                              onChange={(e) => updateCombination(index, rowIndex, "freightCostPerUnit", Number(e.target.value) || 0)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Landed/Unit (auto)</label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={row.landedCostPerUnit || ""}
                              readOnly
                              className="w-full rounded-lg border border-gray-200 bg-gray-100 px-2 py-1.5 text-xs text-gray-600 cursor-not-allowed"
                              placeholder="Cost + Freight"
                            />
                          </div>
                          <div className="flex items-end gap-1">
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCombination(index, rowIndex)}
                                className="rounded-lg border border-red-300 bg-red-50 px-2 py-1.5 text-[10px] text-red-700 hover:bg-red-100"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-[0.5fr,1.5fr]">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">ETA (Days)</label>
                            <input
                              type="number"
                              min={0}
                              value={row.etaDays ?? ""}
                              onChange={(e) => updateCombination(index, rowIndex, "etaDays", e.target.value ? Number(e.target.value) : null)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-medium text-gray-600">Remarks</label>
                            <input
                              type="text"
                              value={row.remarks}
                              onChange={(e) => updateCombination(index, rowIndex, "remarks", e.target.value)}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        {/* Procurement Images (optional) - per combination row */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-medium text-gray-600">Procurement Images <span className="text-red-500">*</span></div>
                          <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                            Choose Files
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleCombinationImageChange(index, rowIndex, e)}
                            />
                          </label>
                          {(combinationImagePreviews[`${index}-${rowIndex}`]?.length ?? 0) > 0 && (
                            <div className="grid grid-cols-4 gap-2 mt-1">
                              {combinationImagePreviews[`${index}-${rowIndex}`].map((src, imgIdx) => (
                                <div key={`preview-${rowIndex}-${imgIdx}`} className="h-16 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                  <img src={src} alt={`New ${imgIdx + 1}`} className="h-full w-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Previously saved images for this combination row */}
                        {row.procurementImagePaths && row.procurementImagePaths.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-medium text-gray-500">Previously uploaded:</div>
                            <div className="grid grid-cols-4 gap-2">
                              {row.procurementImagePaths.map((imagePath: string, imgIdx: number) => {
                                const imageUrl = imagePath.startsWith("http") ? imagePath : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                                return (
                                  <div
                                    key={`row-${rowIndex}-img-${imgIdx}`}
                                    className="relative h-16 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`Saved image ${imgIdx + 1}`}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E";
                                        target.onerror = null;
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => submitCombination(index, !!isSubmitted)}
                        disabled={submitting === index}
                        className="btn-primary whitespace-nowrap"
                      >
                        {submitting === index ? "Submitting..." : isSubmitted ? "Update" : "Submit combinations"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-[1fr,1fr,1fr,auto]">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Cost per Unit <span className="text-red-600">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={currentCostPerUnit}
                          onChange={(e) => updateCost(index, "costPerUnit", Number(e.target.value) || 0)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Freight Cost per Unit <span className="text-red-600">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={currentFreightCostPerUnit}
                          onChange={(e) => updateCost(index, "freightCostPerUnit", Number(e.target.value) || 0)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Landed Cost per Unit <span className="text-gray-400 font-normal">(auto)</span></label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={currentLandedCostPerUnit}
                          readOnly
                          className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 cursor-not-allowed outline-none"
                          placeholder="Cost + Freight"
                        />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isSubmitted && savedResponse?.submittedAt && (
                          <div className="text-[10px] text-gray-500 text-right">
                            Submitted {new Date(savedResponse.submittedAt).toLocaleString()}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => submitCombination(index, !!isSubmitted)}
                          disabled={submitting === index}
                          className="btn-primary whitespace-nowrap"
                        >
                          {submitting === index ? "Submitting..." : isSubmitted ? "Update" : "Submit"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[0.5fr,1.5fr]">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">ETA (Days)</label>
                        <input
                          type="number"
                          min={0}
                          value={currentEtaDays}
                          onChange={(e) => updateEtaDays(index, Number(e.target.value) || 0)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-gray-700">Remarks</label>
                        <textarea
                          rows={2}
                          value={currentRemarks}
                          onChange={(e) => updateRemarks(index, e.target.value)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
                          placeholder="Add any remarks or notes..."
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Warehouse stock (SKU from inventory) - per product */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-700">
                      Warehouse stock (SKU search)
                    </label>
                    <button
                      type="button"
                      onClick={() => addWarehouseStockRow(index)}
                      className="text-xs font-medium text-gray-900 hover:text-gray-700"
                    >
                      + Add SKU row
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(warehouseStockByDetail[index] || [{ sku: "", country: "", qty: 0, costPerUnit: 0, currency: "AED" as CurrencyCode }]).map(
                      (row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="rounded-lg border border-gray-200 bg-gray-50/50 p-2 space-y-2"
                        >
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[140px] flex-1 space-y-1">
                              <label className="block text-[10px] font-medium text-gray-600">SKU <span className="text-red-500">*</span></label>
                              <SkuSearchInput
                                value={row.sku}
                                onSelect={(item: InventorySku) => {
                                  updateWarehouseStock(index, rowIndex, "sku", item.sku);
                                  updateWarehouseStock(index, rowIndex, "country", item.country);
                                  updateWarehouseStock(index, rowIndex, "qty", item.quantity);
                                }}
                              />
                            </div>
                            <div className="w-24 space-y-1">
                              <label className="block text-[10px] font-medium text-gray-600">Country</label>
                              <input
                                type="text"
                                readOnly
                                value={row.country || ""}
                                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-2 py-1.5 text-xs text-gray-700"
                                placeholder="Auto"
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <label className="block text-[10px] font-medium text-gray-600">Qty</label>
                              <input
                                type="number"
                                min={0}
                                readOnly
                                value={row.qty || ""}
                                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-2 py-1.5 text-xs text-gray-700"
                                placeholder="0"
                              />
                            </div>
                            <div className="w-24 space-y-1">
                              <label className="block text-[10px] font-medium text-gray-600">Currency</label>
                              <select
                                value={row.currency ?? "AED"}
                                onChange={(e) => updateWarehouseStock(index, rowIndex, "currency", e.target.value as CurrencyCode)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                              >
                                <option value="AED">AED</option>
                                <option value="SAR">SAR</option>
                                <option value="PKR">PKR</option>
                              </select>
                            </div>
                            <div className="w-28 space-y-1">
                              <label className="block text-[10px] font-medium text-gray-600">Cost/unit ({(row.currency ?? "AED")})</label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={row.costPerUnit || ""}
                                onChange={(e) =>
                                  updateWarehouseStock(
                                    index,
                                    rowIndex,
                                    "costPerUnit",
                                    e.target.value === "" ? 0 : Number(e.target.value)
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
                                placeholder="0"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeWarehouseStockRow(index, rowIndex)}
                              className="rounded-lg border border-red-300 bg-red-50 px-2 py-1.5 text-[10px] text-red-700 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] font-medium text-gray-600">Procurement Images <span className="text-red-500">*</span></div>
                            <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50">
                              Choose Files
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleWarehouseImageChange(index, rowIndex, e)}
                              />
                            </label>
                            {(row.procurementImagePreviews?.length ?? 0) > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-1">
                                {row.procurementImagePreviews?.map((src, imgIdx) => (
                                  <div key={`wh-preview-${rowIndex}-${imgIdx}`} className="h-16 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                    <img src={src} alt={`New ${imgIdx + 1}`} className="h-full w-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {row.procurementImagePaths && row.procurementImagePaths.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-1">
                                {row.procurementImagePaths.map((imagePath: string, imgIdx: number) => {
                                  const imageUrl = imagePath.startsWith("http") ? imagePath : `${SUPABASE_URL}/storage/v1/object/public/qr-attachments/${imagePath}`;
                                  return (
                                    <div key={`wh-saved-${rowIndex}-${imgIdx}`} className="h-16 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                      <img
                                        src={imageUrl}
                                        alt={`Saved ${imgIdx + 1}`}
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3C/svg%3E";
                                          target.onerror = null;
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* End procurement section */}

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
