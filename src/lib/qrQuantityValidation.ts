import type { PrProduct } from "@/types/workflows";
import { getRequestedQuantity } from "@/lib/qrPurchaseDetails";

function getExpectedQuantity(
  detail: {
    productName?: string;
    countryDetails?: Array<{ country: string; quantity: number }>;
    quantity?: number;
    movementSplits?: Array<{ quantity: number; status: string }>;
  },
  destinationCountry: string,
  inventoryAvailable?: number
): number {
  const readySplitQty = detail.movementSplits
    ?.filter((s) => s.status === "ready")
    .reduce((sum, s) => sum + (s.quantity || 0), 0);

  if (readySplitQty != null && readySplitQty > 0) {
    return readySplitQty;
  }

  const requested = getRequestedQuantity(detail);
  if (
    inventoryAvailable != null &&
    inventoryAvailable !== requested &&
    (!detail.movementSplits || detail.movementSplits.length === 0)
  ) {
    return -1;
  }

  if (detail.countryDetails && detail.countryDetails.length > 0) {
    const cd = detail.countryDetails.find((c) => c.country === destinationCountry);
    return cd?.quantity ?? 0;
  }
  return detail.quantity ?? 0;
}

/** Validate PR product quantities match the source QR countryDetails (or Movements ready split). */
export function validateProductsAgainstQr(
  products: PrProduct[],
  qr: { purchase_details?: unknown[]; procurement_response?: unknown }
): string | null {
  const details = (qr.purchase_details ?? []) as Array<{
    productName?: string;
    countryDetails?: Array<{ country: string; quantity: number }>;
    quantity?: number;
    destinationCountry?: string;
    destinationCountries?: string[];
    movementSplits?: Array<{ quantity: number; status: string }>;
  }>;

  const procurementResponse =
    qr.procurement_response && typeof qr.procurement_response === "object"
      ? (qr.procurement_response as Record<number, { inventoryAvailable?: number }>)
      : {};

  for (const product of products) {
    const detailIndex = details.findIndex(
      (d) =>
        d.productName?.trim().toLowerCase() === product.productName?.trim().toLowerCase()
    );
    const detail = detailIndex >= 0 ? details[detailIndex] : undefined;
    if (!detail) continue;

    const inventoryAvailable = procurementResponse[detailIndex]?.inventoryAvailable;
    const expectedQty = getExpectedQuantity(detail, product.destinationCountry, inventoryAvailable);

    if (expectedQty === -1) {
      return `Please split the movement for ${product.productName} before converting — inventory available (${inventoryAvailable}) differs from requested quantity.`;
    }

    if (expectedQty > 0 && product.quantity !== expectedQty) {
      return `Quantity for ${product.productName} (${product.destinationCountry}) must remain ${expectedQty} as set in the QR.`;
    }
  }

  return null;
}
