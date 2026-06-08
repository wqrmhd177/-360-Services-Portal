import { toQrAttachmentUrl } from "./qrAttachments";

export type ProcurementImageGroup = {
  productName: string;
  label: string;
  imageUrls: string[];
};

type PurchaseDetail = {
  productName?: string;
};

export type ProcurementResponseEntry = {
  combinations?: Array<{
    destinationCountry?: string;
    countryOfPurchase?: string;
    shippingType?: string;
    movementType?: string;
    procurementImagePaths?: string[];
  }>;
  warehouseStock?: Array<{
    sku?: string;
    warehouse?: string;
    country?: string;
    procurementImagePaths?: string[];
  }>;
  procurementImagePaths?: string[];
};

export type ProcurementResponseMap = Record<number, ProcurementResponseEntry>;

function cap(s: string | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function extractProcurementImageGroups(
  purchaseDetails: PurchaseDetail[] | null | undefined,
  procurementResponse: ProcurementResponseMap | null | undefined
): ProcurementImageGroup[] {
  if (!purchaseDetails?.length || !procurementResponse) return [];

  const groups: ProcurementImageGroup[] = [];

  purchaseDetails.forEach((detail, index) => {
    const productName = detail.productName || `Product ${index + 1}`;
    const response =
      procurementResponse[index] ??
      (procurementResponse as Record<string, ProcurementResponseEntry | undefined>)[
        String(index)
      ];
    if (!response) return;

    if (response.combinations?.length) {
      response.combinations.forEach((combo, comboIdx) => {
        const paths = combo.procurementImagePaths?.filter(Boolean) ?? [];
        if (paths.length === 0) return;
        const parts = [
          combo.destinationCountry,
          combo.countryOfPurchase,
          combo.shippingType ? cap(combo.shippingType) : "",
          combo.movementType ? cap(combo.movementType) : "",
        ].filter(Boolean);
        groups.push({
          productName,
          label: `Combination ${comboIdx + 1}${parts.length ? ` · ${parts.join(" · ")}` : ""}`,
          imageUrls: paths.map(toQrAttachmentUrl).filter(Boolean),
        });
      });
    }

    if (response.warehouseStock?.length) {
      response.warehouseStock.forEach((row, rowIdx) => {
        const paths = row.procurementImagePaths?.filter(Boolean) ?? [];
        if (paths.length === 0) return;
        const skuLabel = row.sku || row.warehouse || `Row ${rowIdx + 1}`;
        const country = row.country ? ` · ${row.country}` : "";
        groups.push({
          productName,
          label: `Warehouse · SKU ${skuLabel}${country}`,
          imageUrls: paths.map(toQrAttachmentUrl).filter(Boolean),
        });
      });
    }

    const legacyPaths = response.procurementImagePaths?.filter(Boolean) ?? [];
    if (
      legacyPaths.length > 0 &&
      (!response.combinations || response.combinations.length === 0)
    ) {
      groups.push({
        productName,
        label: "Procurement response",
        imageUrls: legacyPaths.map(toQrAttachmentUrl).filter(Boolean),
      });
    }
  });

  return groups;
}
