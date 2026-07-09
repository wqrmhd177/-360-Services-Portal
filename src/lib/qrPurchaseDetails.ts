/** Label for a QR purchase detail line (supports legacy productName and new SKU fields). */
export function getPurchaseDetailLabel(detail: {
  productName?: string;
  fromSku?: string;
  toSku?: string;
}): string {
  if (detail.fromSku?.trim() && detail.toSku?.trim()) {
    return `${detail.fromSku.trim()} → ${detail.toSku.trim()}`;
  }
  if (detail.fromSku?.trim()) return detail.fromSku.trim();
  if (detail.toSku?.trim()) return detail.toSku.trim();
  return detail.productName?.trim() || "—";
}

export type QrCountryDetail = {
  country: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  /** @deprecated Legacy field — prefer unitPrice */
  targetPrice?: number;
  remarks?: string;
  currency?: "AED" | "SAR" | "PKR";
};

export function countryDetailTotal(quantity: number, unitPrice: number): number {
  return (quantity || 0) * (unitPrice || 0);
}

export function normalizeCountryDetailRow(raw: Record<string, unknown>): QrCountryDetail {
  const quantity = Number(raw.quantity ?? 0);
  const unitPrice = Number(raw.unitPrice ?? raw.targetPrice ?? 0);
  return {
    country: String(raw.country ?? ""),
    quantity,
    unitPrice,
    totalPrice: Number(raw.totalPrice ?? countryDetailTotal(quantity, unitPrice)),
    targetPrice: unitPrice,
    remarks: raw.remarks != null ? String(raw.remarks) : undefined,
    currency:
      raw.currency === "SAR" || raw.currency === "PKR" || raw.currency === "AED"
        ? raw.currency
        : undefined,
  };
}

export type MovementSplit = {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: "ready" | "pending";
};

export function getRequestedQuantity(detail: {
  countryDetails?: Array<{ quantity?: number }>;
  quantity?: number;
}): number {
  if (detail.countryDetails?.length) {
    return detail.countryDetails.reduce((s, cd) => s + (Number(cd.quantity) || 0), 0);
  }
  return Number(detail.quantity) || 0;
}

export function enrichPurchaseDetailForStorage(detail: Record<string, unknown>): Record<string, unknown> {
  const fromSku = String(detail.fromSku ?? "").trim();
  const toSku = String(detail.toSku ?? "").trim();
  const productName =
    fromSku && toSku
      ? `${fromSku} → ${toSku}`
      : String(detail.productName ?? (fromSku || toSku || "")).trim();

  const countryDetails = Array.isArray(detail.countryDetails)
    ? detail.countryDetails.map((cd) => {
        const row = normalizeCountryDetailRow(cd as Record<string, unknown>);
        return {
          ...row,
          targetPrice: row.unitPrice,
        };
      })
    : undefined;

  const quantity =
    countryDetails?.reduce((s, cd) => s + (cd.quantity || 0), 0) ??
    Number(detail.quantity ?? 0);
  const unitPrice =
    countryDetails?.[0]?.unitPrice ?? Number(detail.unitPrice ?? detail.targetPrice ?? 0);
  const totalPrice =
    countryDetails?.reduce((s, cd) => s + (cd.totalPrice || 0), 0) ??
    countryDetailTotal(quantity, unitPrice);

  return {
    ...detail,
    fromSku: fromSku || undefined,
    toSku: toSku || undefined,
    productName: productName || undefined,
    countryDetails,
    quantity,
    unitPrice,
    targetPrice: unitPrice,
    totalPrice,
    imagePaths: [],
  };
}
