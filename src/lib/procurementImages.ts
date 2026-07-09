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
  inventoryAvailable?: number;
  combinations?: Array<{
    destinationCountry?: string;
    countryOfPurchase?: string;
    shippingType?: string;
    movementType?: string;
    costPerUnit?: number;
    freightCostPerUnit?: number;
    procurementImagePaths?: string[];
  }>;
  warehouseStock?: Array<{
    sku?: string;
    warehouse?: string;
    country?: string;
    costPerUnit?: number;
    procurementImagePaths?: string[];
  }>;
  procurementImagePaths?: string[];
};

export type ProcurementResponseMap = Record<number, ProcurementResponseEntry>;

/** PO/PR line used to pick the matching procurement combination or warehouse SKU. */
export type PoProcurementMatchLine = {
  productName?: string;
  skuCode?: string;
  destinationCountry?: string;
  countryOfPurchase?: string;
  shippingType?: string;
  movementType?: string;
};

type JsonProductLine = {
  productName?: string;
  product_name?: string;
  skuCode?: string;
  sku_code?: string;
  destinationCountry?: string;
  countryOfPurchase?: string;
  shippingType?: string;
  movementType?: string;
};

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function responseAtIndex(
  procurementResponse: ProcurementResponseMap,
  index: number
): ProcurementResponseEntry | undefined {
  return (
    procurementResponse[index] ??
    (procurementResponse as Record<string, ProcurementResponseEntry | undefined>)[
      String(index)
    ]
  );
}

function cap(s: string | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseProductLines(raw: unknown): JsonProductLine[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return parseProductLines(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as JsonProductLine[]) : [];
}

function toMatchLine(raw: JsonProductLine): PoProcurementMatchLine {
  return {
    productName: raw.productName ?? raw.product_name,
    skuCode: raw.skuCode ?? raw.sku_code,
    destinationCountry: raw.destinationCountry,
    countryOfPurchase: raw.countryOfPurchase,
    shippingType: raw.shippingType,
    movementType: raw.movementType,
  };
}

/** Build match criteria from PO line items, enriched from linked PR when needed. */
export function buildPoProcurementMatchLines(
  poProducts: unknown,
  prProducts: unknown
): PoProcurementMatchLine[] {
  const poLines = parseProductLines(poProducts).map(toMatchLine);
  const prLines = parseProductLines(prProducts).map(toMatchLine);

  if (poLines.length > 0) {
    return poLines.map((poLine) => {
      const prMatch = prLines.find(
        (pr) =>
          norm(pr.productName) === norm(poLine.productName) &&
          (!norm(poLine.skuCode) ||
            !norm(pr.skuCode) ||
            norm(pr.skuCode) === norm(poLine.skuCode))
      );
      return {
        productName: poLine.productName ?? prMatch?.productName,
        skuCode: poLine.skuCode ?? prMatch?.skuCode,
        destinationCountry: poLine.destinationCountry ?? prMatch?.destinationCountry,
        countryOfPurchase: poLine.countryOfPurchase ?? prMatch?.countryOfPurchase,
        shippingType: poLine.shippingType ?? prMatch?.shippingType,
        movementType: poLine.movementType ?? prMatch?.movementType,
      };
    });
  }

  return prLines;
}

function lineMatchesProductName(line: PoProcurementMatchLine, productName: string): boolean {
  const lineName = norm(line.productName);
  const detailName = norm(productName);
  if (!lineName || !detailName) return true;
  return lineName === detailName;
}

function lineMatchesCombination(
  line: PoProcurementMatchLine,
  combo: NonNullable<ProcurementResponseEntry["combinations"]>[number],
  productName: string
): boolean {
  if (!lineMatchesProductName(line, productName)) return false;

  const hasComboKeys =
    line.destinationCountry || line.shippingType || line.movementType || line.countryOfPurchase;

  if (!hasComboKeys) return true;

  if (
    line.destinationCountry &&
    norm(line.destinationCountry) !== norm(combo.destinationCountry)
  ) {
    return false;
  }
  if (
    line.countryOfPurchase &&
    norm(line.countryOfPurchase) !== norm(combo.countryOfPurchase)
  ) {
    return false;
  }
  if (line.shippingType && norm(line.shippingType) !== norm(combo.shippingType)) {
    return false;
  }
  if (line.movementType && norm(line.movementType) !== norm(combo.movementType)) {
    return false;
  }
  return true;
}

function lineMatchesWarehouse(
  line: PoProcurementMatchLine,
  row: NonNullable<ProcurementResponseEntry["warehouseStock"]>[number],
  productName: string
): boolean {
  if (!lineMatchesProductName(line, productName)) return false;

  const lineSku = norm(line.skuCode);
  if (!lineSku) return false;

  const rowSku = norm(row.sku ?? row.warehouse);
  return rowSku !== "" && rowSku === lineSku;
}

function anyLineMatchesCombination(
  matchLines: PoProcurementMatchLine[],
  combo: NonNullable<ProcurementResponseEntry["combinations"]>[number],
  productName: string
): boolean {
  return matchLines.some((line) => lineMatchesCombination(line, combo, productName));
}

function anyLineMatchesWarehouse(
  matchLines: PoProcurementMatchLine[],
  row: NonNullable<ProcurementResponseEntry["warehouseStock"]>[number],
  productName: string
): boolean {
  return matchLines.some((line) => lineMatchesWarehouse(line, row, productName));
}

function anyLineMatchesLegacy(
  matchLines: PoProcurementMatchLine[],
  productName: string
): boolean {
  return matchLines.some((line) => lineMatchesProductName(line, productName));
}

export function extractProcurementImageGroups(
  purchaseDetails: PurchaseDetail[] | null | undefined,
  procurementResponse: ProcurementResponseMap | null | undefined,
  options?: { matchLines?: PoProcurementMatchLine[] }
): ProcurementImageGroup[] {
  if (!purchaseDetails?.length || !procurementResponse) return [];

  const matchLines = options?.matchLines;
  const filterByPo = matchLines !== undefined;
  if (filterByPo && matchLines.length === 0) return [];

  const groups: ProcurementImageGroup[] = [];

  purchaseDetails.forEach((detail, index) => {
    const productName = detail.productName || `Product ${index + 1}`;
    const response = responseAtIndex(procurementResponse, index);
    if (!response) return;

    if (response.combinations?.length) {
      response.combinations.forEach((combo, comboIdx) => {
        if (filterByPo && !anyLineMatchesCombination(matchLines, combo, productName)) {
          return;
        }
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
        if (filterByPo && !anyLineMatchesWarehouse(matchLines, row, productName)) {
          return;
        }
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
      if (filterByPo && !anyLineMatchesLegacy(matchLines, productName)) {
        return;
      }
      groups.push({
        productName,
        label: "Procurement response",
        imageUrls: legacyPaths.map(toQrAttachmentUrl).filter(Boolean),
      });
    }
  });

  return groups;
}
