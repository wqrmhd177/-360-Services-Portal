import { parseCsv } from "@/lib/operations/opSheet";

/** Product Image's workbook. Backend sync only — never fetch from the browser. */
export const PICKING_SHEET_ID = "1z7RGLtQ7yXqYuBviBm1eUTissefxiqB5-_J1gOwz57U";
export const PICKING_IMAGES_GID = "198505646";
export const PICKING_IMAGES_SHEET = "Product Images";

/**
 * Master Products workbook — a simpler 4-column sheet (A=Product Name, B=SKU,
 * C=In-cell Image, D=Image URL auto-filled by the Apps Script).
 * Set MASTER_PICKING_SHEET_ID in env. The sheet must be shared "Anyone with the link (Viewer)".
 */
export const MASTER_PICKING_SHEET_ID = process.env.MASTER_PICKING_SHEET_ID ?? "";
export const MASTER_PRODUCTS_SHEET = "Master Products";

export type PickingProductRow = {
  sku: string;
  product_name: string;
  image_url: string | null;
  sheet_image_url: string | null;
  source: "sheet" | "manual" | "bulk";
};

function headerIndex(headers: string[], ...names: string[]): number | null {
  const lower = headers.map((h) => h.trim().toLowerCase().replace(/_/g, " "));
  for (const name of names) {
    const needle = name.trim().toLowerCase().replace(/_/g, " ");
    const exact = lower.indexOf(needle);
    if (exact >= 0) return exact;
  }
  for (let i = 0; i < lower.length; i++) {
    for (const name of names) {
      const needle = name.trim().toLowerCase().replace(/_/g, " ");
      if (needle && lower[i].includes(needle)) return i;
    }
  }
  return null;
}

function cell(row: string[], idx: number | null): string {
  if (idx == null || idx >= row.length) return "";
  return row[idx].trim();
}

function looksLikeSku(value: string): boolean {
  const v = value.trim();
  if (v.length < 4 || v.length > 80) return false;
  if (/\s/.test(v)) return false;
  return /[A-Za-z]/.test(v) && /[0-9-]/.test(v);
}

/** Column A is "Name: SKU" — keep only the product name. */
export function productNameFromSheet(raw: string, sku: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return sku;
  const idx = trimmed.lastIndexOf(":");
  if (idx <= 0) return trimmed;
  const suffix = trimmed.slice(idx + 1).trim();
  if (
    !suffix ||
    (sku && suffix.toLowerCase() === sku.toLowerCase()) ||
    looksLikeSku(suffix)
  ) {
    const name = trimmed.slice(0, idx).trim();
    return name || trimmed;
  }
  return trimmed;
}

export function factsFromPickingCsv(text: string): PickingProductRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0];
  const iSku = headerIndex(headers, "sku");
  const iName = headerIndex(
    headers,
    "product description & sku",
    "product description",
    "product name",
  );
  const iLink = headerIndex(headers, "link", "image url", "image link");

  if (iSku == null) {
    throw new Error(
      `Product Images is missing the SKU column. Headers: ${headers.join(", ")}`,
    );
  }

  const bySku = new Map<string, PickingProductRow>();
  for (const row of rows.slice(1)) {
    const sku = cell(row, iSku);
    if (!sku) continue;
    const rawName = cell(row, iName);
    const name = productNameFromSheet(rawName || sku, sku);
    const link = cell(row, iLink);
    const imageUrl =
      link && /^https?:\/\//i.test(link) ? link : null;
    const prev = bySku.get(sku);
    if (prev?.image_url && !imageUrl) continue;
    bySku.set(sku, {
      sku,
      product_name: name,
      image_url: imageUrl ?? prev?.image_url ?? null,
      sheet_image_url: imageUrl ?? prev?.sheet_image_url ?? null,
      source: "sheet",
    });
  }
  return [...bySku.values()];
}

export function pickingCsvUrl(): string {
  return (
    `https://docs.google.com/spreadsheets/d/${PICKING_SHEET_ID}/export` +
    `?format=csv&gid=${PICKING_IMAGES_GID}`
  );
}

export function pickingCsvGvizUrl(): string {
  return (
    `https://docs.google.com/spreadsheets/d/${PICKING_SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&gid=${PICKING_IMAGES_GID}`
  );
}

function pickingCsvChunkUrl(startRow: number, endRow: number): string {
  const range = `A${startRow}:E${endRow}`;
  return (
    `https://docs.google.com/spreadsheets/d/${PICKING_SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&gid=${PICKING_IMAGES_GID}` +
    `&range=${encodeURIComponent(range)}`
  );
}

async function fetchCsvText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "360-portal-picking-sync/1.0" },
  });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<!")) return null;
  return text;
}

async function fetchPickingCsvChunked(): Promise<string> {
  const chunks: string[][] = [];
  let header: string[] | null = null;
  const size = 4000;
  for (let start = 1; start < 40000; start += size) {
    const end = start + size - 1;
    const text = await fetchCsvText(pickingCsvChunkUrl(start, end));
    if (!text) break;
    const rows = parseCsv(text).filter((row) =>
      row.some((cell) => String(cell ?? "").trim()),
    );
    if (rows.length === 0) break;
    if (!header) {
      header = rows[0];
      chunks.push(...rows.slice(1));
    } else if (
      rows[0].join("|").toLowerCase() === header.join("|").toLowerCase()
    ) {
      chunks.push(...rows.slice(1));
    } else {
      chunks.push(...rows);
    }
    if (rows.length < Math.min(50, size)) break;
  }
  if (!header || chunks.length === 0) {
    throw new Error("chunked csv empty");
  }
  return [header, ...chunks]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function csvLinkCount(text: string): number {
  try {
    return factsFromPickingCsv(text).filter((row) => row.image_url).length;
  } catch {
    return 0;
  }
}

export async function fetchPickingSheetCsv(): Promise<string> {
  const candidates: string[] = [];
  const exportCsv = await fetchCsvText(pickingCsvUrl());
  if (exportCsv) candidates.push(exportCsv);
  const gvizCsv = await fetchCsvText(pickingCsvGvizUrl());
  if (gvizCsv) candidates.push(gvizCsv);
  try {
    candidates.push(await fetchPickingCsvChunked());
  } catch {
    // fall through to whatever we already have
  }
  if (candidates.length === 0) {
    throw new Error(
      "Product Images is not readable from the backend. Share the sheet with anyone-with-the-link (viewer).",
    );
  }
  let best = candidates[0];
  let bestCount = csvLinkCount(best);
  for (const candidate of candidates.slice(1)) {
    const count = csvLinkCount(candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

// ─── Master Products sheet helpers ───────────────────────────────────────────

/**
 * Parse CSV from the Master Products sheet.
 * Column layout: A=Product Name, B=SKU, C=In-cell Image (ignored), D=Image URL.
 */
export function factsFromMasterProductsCsv(text: string): PickingProductRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0];
  const iName = headerIndex(headers, "product name", "name", "product description & sku", "product description") ?? 0;
  const iSku = headerIndex(headers, "sku", "product sku") ?? 1;
  const iLink = headerIndex(headers, "image url", "link", "image link", "picture url") ?? 3;

  const bySku = new Map<string, PickingProductRow>();
  for (const row of rows.slice(1)) {
    const sku = cell(row, iSku);
    if (!sku) continue;
    const rawName = cell(row, iName);
    const name = productNameFromSheet(rawName || sku, sku);
    const link = cell(row, iLink);
    const imageUrl = link && /^https?:\/\//i.test(link) ? link : null;
    const prev = bySku.get(sku);
    if (prev?.image_url && !imageUrl) continue;
    bySku.set(sku, {
      sku,
      product_name: name,
      image_url: imageUrl ?? prev?.image_url ?? null,
      sheet_image_url: imageUrl ?? prev?.sheet_image_url ?? null,
      source: "sheet",
    });
  }
  return [...bySku.values()];
}

function masterCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

function masterGvizUrl(sheetId: string): string {
  return (
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`
  );
}

function masterCsvChunkUrl(sheetId: string, startRow: number, endRow: number): string {
  const range = `A${startRow}:D${endRow}`;
  return (
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv` +
    `&range=${encodeURIComponent(range)}`
  );
}

async function fetchMasterCsvChunked(sheetId: string): Promise<string> {
  const chunks: string[][] = [];
  let header: string[] | null = null;
  const size = 4000;
  for (let start = 1; start < 40000; start += size) {
    const end = start + size - 1;
    const text = await fetchCsvText(masterCsvChunkUrl(sheetId, start, end));
    if (!text) break;
    const parsed = parseCsv(text).filter((row) => row.some((c) => String(c ?? "").trim()));
    if (parsed.length === 0) break;
    if (!header) {
      header = parsed[0];
      chunks.push(...parsed.slice(1));
    } else if (parsed[0].join("|").toLowerCase() === header.join("|").toLowerCase()) {
      chunks.push(...parsed.slice(1));
    } else {
      chunks.push(...parsed);
    }
    if (parsed.length < Math.min(50, size)) break;
  }
  if (!header || chunks.length === 0) throw new Error("master csv empty");
  return [header, ...chunks]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function masterLinkCount(text: string): number {
  try {
    return factsFromMasterProductsCsv(text).filter((r) => r.image_url).length;
  } catch {
    return 0;
  }
}

export async function fetchMasterProductsSheetCsv(): Promise<string> {
  const id = MASTER_PICKING_SHEET_ID;
  if (!id) throw new Error("MASTER_PICKING_SHEET_ID is not set. Add it to your environment variables.");

  const candidates: string[] = [];
  const exportCsv = await fetchCsvText(masterCsvUrl(id));
  if (exportCsv) candidates.push(exportCsv);
  const gvizCsv = await fetchCsvText(masterGvizUrl(id));
  if (gvizCsv) candidates.push(gvizCsv);
  try { candidates.push(await fetchMasterCsvChunked(id)); } catch { /* ignore */ }
  if (candidates.length === 0) {
    throw new Error(
      "Master Products sheet is not readable. Make sure it is shared as 'Anyone with the link (Viewer)' and MASTER_PICKING_SHEET_ID is correct.",
    );
  }
  let best = candidates[0];
  let bestCount = masterLinkCount(best);
  for (const candidate of candidates.slice(1)) {
    const count = masterLinkCount(candidate);
    if (count > bestCount) { best = candidate; bestCount = count; }
  }
  return best;
}

export function pickingDocumentLabel(name: string, sku: string): string {
  const clean = name.trim();
  if (!clean || clean === "Not Available") {
    return `Not Available: ${sku}`;
  }
  const colonSku = `: ${sku}`;
  if (clean.toLowerCase().endsWith(colonSku.toLowerCase())) return clean;
  const withSku = ` with ${sku}`;
  if (clean.toLowerCase().endsWith(withSku.toLowerCase())) {
    return `${clean.slice(0, clean.length - withSku.length).trim()}: ${sku}`;
  }
  return `${clean}: ${sku}`;
}
