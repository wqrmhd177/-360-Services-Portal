import type { PoProductLine } from "./poCreate";

export const BULK_PO_CSV_HEADERS = [
  "supplier_name",
  "supplier_location",
  "delivery_partner",
  "delivery_partner_tracking_id",
  "po_type",
  "remarks",
  "product_name",
  "sku_code",
  "quantity",
  "product_cost",
  "freight_cost",
] as const;

export type BulkPoCsvRow = {
  rowNumber: number;
  supplier_name: string;
  supplier_location: string;
  delivery_partner: string;
  delivery_partner_tracking_id?: string;
  po_type: string;
  remarks?: string;
  product_name: string;
  sku_code?: string;
  quantity: number;
  product_cost: number;
  freight_cost: number;
};

export type BulkPoGroup = {
  groupKey: string;
  supplier_name: string;
  supplier_location: string;
  delivery_partner: string;
  delivery_partner_tracking_id: string;
  po_type: string;
  remarks: string | null;
  products: PoProductLine[];
};

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function validatePoHeaderFields(input: {
  supplier_name: string;
  supplier_location: string;
  delivery_partner: string;
}): string | null {
  if (!input.supplier_name.trim()) return "Supplier name is required.";
  if (!input.supplier_location.trim()) return "Supplier location is required.";
  if (!input.delivery_partner.trim()) return "Delivery partner is required.";
  return null;
}

export function validatePoProductLine(
  line: {
    productName: string;
    quantity: number;
    productCostPerUnit?: number;
    freightCostPerUnit?: number;
  },
  label = "Product"
): string | null {
  if (!line.productName.trim()) return `${label}: product name is required.`;
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    return `${label}: quantity must be greater than 0.`;
  }
  if (line.productCostPerUnit != null && Number.isNaN(line.productCostPerUnit)) {
    return `${label}: product cost must be a number.`;
  }
  if (line.freightCostPerUnit != null && Number.isNaN(line.freightCostPerUnit)) {
    return `${label}: freight cost must be a number.`;
  }
  return null;
}

/** Parse one CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseCsvText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");
  return lines.map(parseCsvLine);
}

export function parseBulkPoCsv(text: string): {
  rows: BulkPoCsvRow[];
  errors: string[];
} {
  const table = parseCsvText(text);
  if (table.length === 0) {
    return { rows: [], errors: ["CSV file is empty."] };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const required = [
    "supplier_name",
    "supplier_location",
    "delivery_partner",
    "product_name",
    "quantity",
    "product_cost",
    "freight_cost",
  ];
  const missing = required.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] };
  }

  const colIndex = (name: string) => header.indexOf(name);
  const rows: BulkPoCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const rowNumber = i + 1;
    const get = (name: string) => {
      const idx = colIndex(name);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };

    const quantity = Number(get("quantity"));
    const productCost = Number(get("product_cost"));
    const freightCost = Number(get("freight_cost"));

    const row: BulkPoCsvRow = {
      rowNumber,
      supplier_name: get("supplier_name"),
      supplier_location: get("supplier_location"),
      delivery_partner: get("delivery_partner"),
      delivery_partner_tracking_id: get("delivery_partner_tracking_id") || undefined,
      po_type: get("po_type") || "internal",
      remarks: get("remarks") || undefined,
      product_name: get("product_name"),
      sku_code: get("sku_code") || undefined,
      quantity,
      product_cost: productCost,
      freight_cost: freightCost,
    };

    if (!row.supplier_name) errors.push(`Row ${rowNumber}: supplier_name is required.`);
    if (!row.supplier_location) errors.push(`Row ${rowNumber}: supplier_location is required.`);
    if (!row.delivery_partner) errors.push(`Row ${rowNumber}: delivery_partner is required.`);
    if (!row.product_name) errors.push(`Row ${rowNumber}: product_name is required.`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Row ${rowNumber}: quantity must be greater than 0.`);
    }
    if (!Number.isFinite(productCost) || productCost < 0) {
      errors.push(`Row ${rowNumber}: product_cost is required and must be a non-negative number.`);
    }
    if (!Number.isFinite(freightCost) || freightCost < 0) {
      errors.push(`Row ${rowNumber}: freight_cost is required and must be a non-negative number.`);
    }

    rows.push(row);
  }

  return { rows, errors };
}

export function bulkPoGroupKey(row: Pick<BulkPoCsvRow, "supplier_name" | "supplier_location" | "delivery_partner">): string {
  return `${norm(row.supplier_name)}|${norm(row.supplier_location)}|${norm(row.delivery_partner)}`;
}

export type BulkPoGroupingMode = "grouped" | "split" | "single";

export function rowToProductLine(row: BulkPoCsvRow) {
  const quantity = row.quantity;
  const productCostPerUnit = row.product_cost;
  const freightCostPerUnit = row.freight_cost;
  return {
    productName: row.product_name.trim(),
    skuCode: row.sku_code?.trim() || undefined,
    quantity,
    productCostPerUnit,
    productCostAmount: productCostPerUnit * quantity,
    freightCostPerUnit,
    freightCostAmount: freightCostPerUnit * quantity,
  };
}

export function groupBulkPoRowsByMode(
  rows: BulkPoCsvRow[],
  mode: BulkPoGroupingMode
): BulkPoGroup[] {
  if (mode === "split") {
    return rows.map((row, index) => ({
      groupKey: `row-${row.rowNumber ?? index + 1}`,
      supplier_name: row.supplier_name.trim(),
      supplier_location: row.supplier_location.trim(),
      delivery_partner: row.delivery_partner.trim(),
      delivery_partner_tracking_id: row.delivery_partner_tracking_id?.trim() ?? "",
      po_type: row.po_type.trim() || "internal",
      remarks: row.remarks?.trim() || null,
      products: [rowToProductLine(row)],
    }));
  }

  if (mode === "single") {
    const first = rows[0];
    return [
      {
        groupKey: "single-po",
        supplier_name: first.supplier_name.trim(),
        supplier_location: first.supplier_location.trim(),
        delivery_partner: first.delivery_partner.trim(),
        delivery_partner_tracking_id: first.delivery_partner_tracking_id?.trim() ?? "",
        po_type: first.po_type.trim() || "internal",
        remarks: first.remarks?.trim() || null,
        products: rows.map(rowToProductLine),
      },
    ];
  }

  return groupBulkPoRows(rows);
}

export function groupBulkPoRows(rows: BulkPoCsvRow[]): BulkPoGroup[] {
  const map = new Map<string, BulkPoGroup>();

  for (const row of rows) {
    const key = bulkPoGroupKey(row);
    let group = map.get(key);
    if (!group) {
      group = {
        groupKey: key,
        supplier_name: row.supplier_name.trim(),
        supplier_location: row.supplier_location.trim(),
        delivery_partner: row.delivery_partner.trim(),
        delivery_partner_tracking_id: row.delivery_partner_tracking_id?.trim() ?? "",
        po_type: row.po_type.trim() || "internal",
        remarks: row.remarks?.trim() || null,
        products: [],
      };
      map.set(key, group);
    }

    if (!group.delivery_partner_tracking_id && row.delivery_partner_tracking_id?.trim()) {
      group.delivery_partner_tracking_id = row.delivery_partner_tracking_id.trim();
    }
    if (!group.remarks && row.remarks?.trim()) {
      group.remarks = row.remarks.trim();
    }

    group.products.push(rowToProductLine(row));
  }

  return Array.from(map.values());
}

export function bulkPoCsvTemplate(): string {
  const header = BULK_PO_CSV_HEADERS.join(",");
  const example = [
    "Acme Supplies",
    "Dubai UAE",
    "DHL",
    "TRK-001",
    "internal",
    "Bulk import example",
    "Widget A",
    "SKU-A",
    "10",
    "25.50",
    "4.00",
  ].join(",");
  return `${header}\n${example}\n`;
}
