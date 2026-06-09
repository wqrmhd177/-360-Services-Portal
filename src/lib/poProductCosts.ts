import {
  buildPoProcurementMatchLines,
  type PoProcurementMatchLine,
  type ProcurementResponseMap,
} from "./procurementImages";
import type { PoProductLine } from "./poCreate";

type PrProductLine = {
  productName?: string;
  product_name?: string;
  skuCode?: string;
  sku_code?: string;
  quantity?: number;
  sellingPricePerUnit?: number;
  landedCostPrice?: number;
  rate?: number;
  totalAmount?: number;
  amount?: number;
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
) {
  return (
    procurementResponse[index] ??
    (procurementResponse as Record<string, (typeof procurementResponse)[number]>)[
      String(index)
    ]
  );
}

function comboMatchesLine(
  line: PoProcurementMatchLine,
  combo: {
    destinationCountry?: string;
    countryOfPurchase?: string;
    shippingType?: string;
    movementType?: string;
    costPerUnit?: number;
  },
  productName: string
): boolean {
  if (line.productName && norm(line.productName) !== norm(productName)) return false;
  if (line.destinationCountry && norm(line.destinationCountry) !== norm(combo.destinationCountry)) {
    return false;
  }
  if (line.countryOfPurchase && norm(line.countryOfPurchase) !== norm(combo.countryOfPurchase)) {
    return false;
  }
  if (line.shippingType && norm(line.shippingType) !== norm(combo.shippingType)) return false;
  if (line.movementType && norm(line.movementType) !== norm(combo.movementType)) return false;
  return true;
}

export function resolveProductCostPerUnit(
  line: PoProcurementMatchLine,
  purchaseDetails: Array<{ productName?: string }> | null | undefined,
  procurementResponse: ProcurementResponseMap | null | undefined
): number | undefined {
  if (!purchaseDetails?.length || !procurementResponse) return undefined;

  for (let index = 0; index < purchaseDetails.length; index++) {
    const productName = purchaseDetails[index]?.productName || `Product ${index + 1}`;
    if (line.productName && norm(line.productName) !== norm(productName)) continue;

    const response = responseAtIndex(procurementResponse, index);
    if (!response) continue;

    if (response.combinations?.length) {
      for (const combo of response.combinations) {
        if (comboMatchesLine(line, combo, productName)) {
          const cost = combo.costPerUnit;
          if (cost != null && !Number.isNaN(Number(cost))) return Number(cost);
        }
      }
    }

    if (response.warehouseStock?.length && line.skuCode) {
      for (const row of response.warehouseStock) {
        if (norm(row.sku ?? row.warehouse) === norm(line.skuCode)) {
          const cost = row.costPerUnit;
          if (cost != null && !Number.isNaN(Number(cost))) return Number(cost);
        }
      }
    }

    const legacyCost = (response as { costPerUnit?: number }).costPerUnit;
    if (legacyCost != null && !Number.isNaN(Number(legacyCost))) {
      return Number(legacyCost);
    }
  }

  return undefined;
}

export function buildPoProductsFromPr(
  prProducts: PrProductLine[] | null | undefined,
  legacyPr?: {
    product_name?: string;
    sku_code?: string;
    quantity?: number;
    rate?: number;
  },
  qr?: {
    purchase_details?: Array<{ productName?: string }> | null;
    procurement_response?: ProcurementResponseMap | null;
  } | null
): PoProductLine[] {
  let lines: PrProductLine[] = [];

  if (prProducts?.length) {
    lines = prProducts;
  } else if (legacyPr?.product_name) {
    lines = [
      {
        productName: legacyPr.product_name,
        skuCode: legacyPr.sku_code,
        quantity: legacyPr.quantity,
        rate: legacyPr.rate,
      },
    ];
  }

  const matchLines = buildPoProcurementMatchLines(lines, lines);
  const purchaseDetails = qr?.purchase_details ?? null;
  const procurementResponse =
    qr?.procurement_response && typeof qr.procurement_response === "object"
      ? qr.procurement_response
      : null;

  return lines.map((p, idx) => {
    const quantity = Number(p.quantity) || 0;
    const sellingRate =
      Number(p.sellingPricePerUnit ?? p.rate) ||
      undefined;
    const amount =
      Number(p.totalAmount ?? p.amount) ||
      (sellingRate != null ? sellingRate * quantity : undefined);

    const matchLine = matchLines[idx] ?? {
      productName: p.productName ?? p.product_name,
      skuCode: p.skuCode ?? p.sku_code,
      destinationCountry: p.destinationCountry,
      countryOfPurchase: p.countryOfPurchase,
      shippingType: p.shippingType,
      movementType: p.movementType,
    };

    const productCostPerUnit =
      resolveProductCostPerUnit(matchLine, purchaseDetails, procurementResponse) ??
      (p.landedCostPrice != null ? Number(p.landedCostPrice) : undefined);

    const productCostAmount =
      productCostPerUnit != null ? productCostPerUnit * quantity : undefined;

    return {
      productName: p.productName || p.product_name || "",
      skuCode: p.skuCode || p.sku_code || undefined,
      quantity,
      rate: sellingRate,
      amount,
      productCostPerUnit,
      productCostAmount,
    };
  });
}
