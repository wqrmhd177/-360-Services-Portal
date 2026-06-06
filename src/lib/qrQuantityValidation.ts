import type { PrProduct } from "@/types/workflows";

/** Validate PR product quantities match the source QR countryDetails. */
export function validateProductsAgainstQr(
  products: PrProduct[],
  qr: { purchase_details?: unknown[] }
): string | null {
  const details = (qr.purchase_details ?? []) as Array<{
    productName?: string;
    countryDetails?: Array<{ country: string; quantity: number }>;
    quantity?: number;
    destinationCountry?: string;
    destinationCountries?: string[];
  }>;

  for (const product of products) {
    const detail = details.find(
      (d) =>
        d.productName?.trim().toLowerCase() === product.productName?.trim().toLowerCase()
    );
    if (!detail) continue;

    let expectedQty = 0;
    if (detail.countryDetails && detail.countryDetails.length > 0) {
      const cd = detail.countryDetails.find(
        (c) => c.country === product.destinationCountry
      );
      expectedQty = cd?.quantity ?? 0;
    } else {
      expectedQty = detail.quantity ?? 0;
    }

    if (expectedQty > 0 && product.quantity !== expectedQty) {
      return `Quantity for ${product.productName} (${product.destinationCountry}) must remain ${expectedQty} as set in the QR.`;
    }
  }

  return null;
}
