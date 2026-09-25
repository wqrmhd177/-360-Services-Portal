import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getPortalSession } from "@/lib/session";
import { parseCsv } from "@/lib/operations/opSheet";
import { productNameFromSheet } from "@/lib/operations/pickingSheet";
import { lookupPickingProducts, upsertPickingProductRows } from "@/lib/operations/picking";
import { recordPickingBulkImport } from "@/lib/operations/pickingAudit";
import { pickingSkuFromFileName, uploadPickingImage } from "@/lib/operations/pickingUploads";

export const maxDuration = 300;

type ParsedRow = {
  sku: string;
  product_name: string;
  image_url: string | null;
};

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = lower.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

function rowsFromCsv(text: string): ParsedRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const headers = table[0];
  const iSku = headerIndex(headers, "sku");
  const iName = headerIndex(
    headers,
    "product name",
    "name",
    "product description & sku",
    "product description",
  );
  const iUrl = headerIndex(headers, "image url", "image", "picture", "link");
  const start = iSku >= 0 ? 1 : 0;
  const skuIdx = iSku >= 0 ? iSku : 0;
  const nameIdx = iName >= 0 ? iName : 1;
  const rows: ParsedRow[] = [];
  for (const row of table.slice(start)) {
    const sku = (row[skuIdx] ?? "").trim();
    if (!sku) continue;
    const rawName = (row[nameIdx] ?? "").trim();
    const url = iUrl >= 0 ? (row[iUrl] ?? "").trim() : "";
    rows.push({
      sku,
      product_name: productNameFromSheet(rawName || sku, sku),
      image_url: /^https?:\/\//i.test(url) ? url : null,
    });
  }
  return rows;
}

async function rowsFromXlsx(buffer: ArrayBuffer): Promise<ParsedRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1);
  const headerMap: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const key = String(cell.value ?? "").trim().toLowerCase();
    if (key) headerMap[key] = col;
  });
  const skuCol = headerMap.sku ?? 1;
  const nameCol =
    headerMap["product name"] ??
    headerMap.name ??
    headerMap["product description & sku"] ??
    headerMap["product description"] ??
    2;
  const urlCol =
    headerMap["image url"] ?? headerMap.image ?? headerMap.picture ?? headerMap.link ?? 0;
  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sku = String(row.getCell(skuCol).text ?? "").trim();
    if (!sku) return;
    const rawName = String(row.getCell(nameCol).text ?? "").trim();
    const url = urlCol ? String(row.getCell(urlCol).text ?? "").trim() : "";
    rows.push({
      sku,
      product_name: productNameFromSheet(rawName || sku, sku),
      image_url: /^https?:\/\//i.test(url) ? url : null,
    });
  });
  return rows;
}

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getPortalSession();
  try {
    const form = await request.formData();
    const spreadsheet = form.get("file");
    const pictureFiles = form
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const skuValues = form.getAll("skus").map((value) => String(value ?? "").trim());
    const nameValues = form.getAll("names").map((value) => String(value ?? "").trim());

    let rows: ParsedRow[] = [];
    if (spreadsheet instanceof File && spreadsheet.size > 0) {
      const name = spreadsheet.name.toLowerCase();
      rows =
        name.endsWith(".xlsx") || name.endsWith(".xls")
          ? await rowsFromXlsx(await spreadsheet.arrayBuffer())
          : rowsFromCsv(await spreadsheet.text());
    }

    const imageBySku = new Map<string, File>();
    if (pictureFiles.length > 0 && skuValues.length === pictureFiles.length) {
      rows = [];
      for (let i = 0; i < pictureFiles.length; i += 1) {
        const sku = skuValues[i] || pickingSkuFromFileName(pictureFiles[i].name);
        if (!sku) continue;
        rows.push({
          sku,
          product_name: nameValues[i] || sku,
          image_url: null,
        });
        imageBySku.set(sku.toLowerCase(), pictureFiles[i]);
      }
    } else {
      for (const file of pictureFiles) {
        const skuKey = pickingSkuFromFileName(file.name);
        if (skuKey) imageBySku.set(skuKey.toLowerCase(), file);
      }
      if (rows.length === 0 && imageBySku.size > 0) {
        rows = [...imageBySku.values()].map((file) => {
          const sku = pickingSkuFromFileName(file.name);
          return { sku, product_name: sku, image_url: null };
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Add product pictures (file name = SKU) or a CSV/Excel file with SKU and Product Name.",
        },
        { status: 400 },
      );
    }

    for (const row of rows) {
      const file = imageBySku.get(row.sku.toLowerCase());
      if (!file) continue;
      try {
        row.image_url = await uploadPickingImage(file, row.sku);
      } catch {
        // keep spreadsheet URL / no image
      }
    }

    const existingRows = await lookupPickingProducts(rows.map((row) => row.sku));
    const existingSkus = new Set(existingRows.map((row) => row.sku.toLowerCase()));

    const written = await upsertPickingProductRows(
      rows.map((row) => ({
        sku: row.sku,
        product_name: row.product_name,
        image_url: row.image_url,
        sheet_image_url:
          row.image_url &&
          /^https?:\/\//i.test(row.image_url) &&
          !row.image_url.includes("/storage/v1/object/public/product_images/")
            ? row.image_url
            : null,
        source: "bulk" as const,
      })),
      session?.email ?? null,
    );

    for (const row of rows) {
      await recordPickingBulkImport({
        sku: row.sku,
        product_name: row.product_name,
        changed_by: session?.email ?? null,
        created: !existingSkus.has(row.sku.toLowerCase()),
      });
    }

    const addedCount = rows.filter((row) => !existingSkus.has(row.sku.toLowerCase())).length;
    const existingCount = rows.length - addedCount;

    return NextResponse.json({
      ok: true,
      rowCount: written,
      added: addedCount,
      existing: existingCount,
      total: rows.length,
      withImages: rows.filter((row) => row.image_url).length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bulk upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
