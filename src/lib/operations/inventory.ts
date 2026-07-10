export const METABASE_INVENTORY_URL =
  "https://zambeel.metabaseapp.com/public/question/316b4595-6180-43fe-b635-839b7f479c26.json";

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
  const q = normalizeSku(query);
  if (!q) return false;
  if (normalizedSku.includes(q)) return true;
  if (q.length >= 4 && normalizedSku.startsWith(q.slice(0, 4))) return true;
  if (q.length >= 3 && normalizedSku.startsWith(q.slice(0, 3))) return true;
  return false;
}

export function matchesInventorySearch(row: InventoryRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const userIdMatch = row.user_id.toLowerCase().includes(q);
  const nameMatch = row.product_name.toLowerCase().includes(q);
  const usernameMatch = row.username.toLowerCase().includes(q);
  const skuMatch = skuMatchesQuery(row.sku, query);

  return userIdMatch || nameMatch || usernameMatch || skuMatch;
}

export function filterInventoryRows(rows: InventoryRow[], query: string): InventoryRow[] {
  if (!query.trim()) return rows;
  return rows.filter((row) => matchesInventorySearch(row, query));
}
