export { METABASE_INVENTORY_URL } from "@/lib/constants";

export interface InventoryRow {
  user_id: string;
  username: string;
  product_name: string;
  sku: string;
  available_quantity: number;
  country: string;
  category: string;
}

export function normalizeSku(value: string): string {
  return value.trim().replace(/^,+/, "").toUpperCase();
}

/** First hyphen-delimited segment of a SKU/search term (family code). */
export function skuFamilyToken(value: string): string {
  const norm = normalizeSku(value);
  const dash = norm.indexOf("-");
  return dash === -1 ? norm : norm.slice(0, dash);
}

export function normalizeInventoryRows(raw: unknown): InventoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const rawSku = String(r.sku ?? "");
      const ownerId = r.sku_owner_id;
      return {
        user_id: ownerId == null || ownerId === "" ? "—" : String(ownerId),
        username: String(r.sku_owner_username ?? "") || "—",
        product_name: String(r.sku_title ?? ""),
        sku: normalizeSku(rawSku) || rawSku.trim(),
        available_quantity: Number(r.quantity ?? 0),
        country: String(r.warehouse_name ?? r.Warehouse_name ?? ""),
        category: String(r.category ?? r.Category ?? ""),
      };
    })
    .filter((row): row is InventoryRow => row != null);
}

function skuMatchesQuery(normalizedSku: string, query: string): boolean {
  const token = skuFamilyToken(query);
  if (!token) return false;
  return skuFamilyToken(normalizedSku).startsWith(token);
}

function matchesNonSkuFields(row: InventoryRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  return (
    row.user_id.toLowerCase().includes(q) ||
    row.product_name.toLowerCase().includes(q) ||
    row.username.toLowerCase().includes(q)
  );
}

/** Count matching hyphen segments from the left (TCD-N-HAE vs TCD-N-KA → 2 vs 2, TCD-N-HAE vs TCD-N-HAE-ZAM → 3). */
export function skuSegmentPrefixDepth(sku: string, query: string): number {
  const skuParts = normalizeSku(sku).split("-");
  const queryParts = normalizeSku(query).split("-");
  let depth = 0;
  const max = Math.min(skuParts.length, queryParts.length);
  for (let i = 0; i < max; i++) {
    if (skuParts[i] === queryParts[i]) depth++;
    else break;
  }
  return depth;
}

/** Lower rank = higher in results. Aligns with search_ops_inventory ORDER BY. */
export function inventorySearchRank(row: InventoryRow, query: string): number {
  const q = query.trim();
  if (!q) return 5;

  const norm = normalizeSku(q);
  const token = skuFamilyToken(q);

  if (row.sku === norm) return 0;
  if (row.sku.startsWith(norm)) return 1;
  if (norm.startsWith(row.sku)) return 2;
  if (row.sku.includes(norm)) return 3;
  if (token && skuFamilyToken(row.sku).startsWith(token)) return 4;
  if (matchesNonSkuFields(row, q)) return 5;
  return 6;
}

export function compareInventorySearch(
  a: InventoryRow,
  b: InventoryRow,
  query: string,
): number {
  const rankDiff = inventorySearchRank(a, query) - inventorySearchRank(b, query);
  if (rankDiff !== 0) return rankDiff;

  const depthDiff =
    skuSegmentPrefixDepth(b.sku, query) - skuSegmentPrefixDepth(a.sku, query);
  if (depthDiff !== 0) return depthDiff;

  if (a.sku.length !== b.sku.length) return a.sku.length - b.sku.length;
  return a.sku.localeCompare(b.sku);
}

export function matchesInventorySearch(row: InventoryRow, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  return skuMatchesQuery(row.sku, query) || matchesNonSkuFields(row, q);
}

export function filterInventoryRows(rows: InventoryRow[], query: string): InventoryRow[] {
  const q = query.trim();
  if (!q) return rows;

  return rows
    .filter((row) => matchesInventorySearch(row, q))
    .sort((a, b) => compareInventorySearch(a, b, q));
}
