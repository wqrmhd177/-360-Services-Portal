export function pickingSkuFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

export type PickingSkuFileRow = {
  sku: string;
  quantity: number;
  good_qty: number | null;
  bad_qty: number | null;
  comments: string;
};

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function looksLikeSkuToken(token: string): boolean {
  const value = token.trim();
  if (!value) return false;
  return (
    /[A-Za-z0-9]+[-_][A-Za-z0-9._-]+/.test(value) ||
    /^[A-Z0-9][A-Z0-9._-]{3,}$/.test(value)
  );
}

export function parsePickingSearchTokens(search: string): string[] {
  const raw = search.trim();
  if (!raw) return [];
  const delimited = raw
    .split(/[\n\r,;|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (delimited.length > 1) return uniquePreserve(delimited);
  const spaces = raw.split(/\s+/).filter(Boolean);
  if (spaces.length > 1 && spaces.filter(looksLikeSkuToken).length >= 2) {
    return uniquePreserve(spaces);
  }
  return [raw];
}

export function escapePickingIlike(value: string): string {
  return value.replace(/[%_,()"]/g, " ").replace(/\s+/g, " ").trim();
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cols.push(cell.trim());
      cell = "";
      continue;
    }
    cell += ch;
  }
  cols.push(cell.trim());
  return cols.map((col) => col.replace(/^"|"$/g, "").trim());
}

export function parseSkuDocumentText(text: string): PickingSkuFileRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const skuIdx = header.findIndex((h) => h === "sku");
  const qtyIdx = header.findIndex(
    (h) =>
      h === "qty" ||
      h === "quantity" ||
      h === "total qty" ||
      h === "received qty" ||
      h === "recived qty",
  );
  const goodIdx = header.findIndex(
    (h) => h === "good qty" || h === "good quantity" || h === "good",
  );
  const badIdx = header.findIndex(
    (h) => h === "bad qty" || h === "bad quantity" || h === "bad",
  );
  const commentsIdx = header.findIndex(
    (h) => h === "comments" || h === "comment" || h === "remarks",
  );
  const hasHeader = skuIdx >= 0;
  const start = hasHeader ? 1 : 0;
  const colSku = hasHeader ? skuIdx : 0;
  const rows: PickingSkuFileRow[] = [];

  for (const line of lines.slice(start)) {
    if (!hasHeader) {
      for (const sku of parsePickingSearchTokens(line)) {
        rows.push({
          sku,
          quantity: 1,
          good_qty: null,
          bad_qty: null,
          comments: "",
        });
      }
      continue;
    }
    const cols = splitCsvLine(line);
    const sku = (cols[colSku] ?? "").trim();
    if (!sku) continue;
    const parsedQty = Number(qtyIdx >= 0 ? cols[qtyIdx] : "");
    const parsedGood = Number(goodIdx >= 0 ? cols[goodIdx] : "");
    const parsedBad = Number(badIdx >= 0 ? cols[badIdx] : "");
    rows.push({
      sku,
      quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
      good_qty: Number.isFinite(parsedGood) && parsedGood >= 0 ? parsedGood : null,
      bad_qty: Number.isFinite(parsedBad) && parsedBad >= 0 ? parsedBad : null,
      comments: commentsIdx >= 0 ? cols[commentsIdx] ?? "" : "",
    });
  }

  const merged = new Map<string, PickingSkuFileRow>();
  for (const row of rows) {
    const key = row.sku.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }
    existing.quantity += row.quantity;
    if (row.good_qty != null) existing.good_qty = row.good_qty;
    if (row.bad_qty != null) existing.bad_qty = row.bad_qty;
    existing.comments = [existing.comments, row.comments].filter(Boolean).join("\n");
  }
  return [...merged.values()];
}
