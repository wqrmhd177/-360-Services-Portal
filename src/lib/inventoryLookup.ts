import {
  METABASE_INVENTORY_URL,
  compareInventorySearch,
  filterInventoryRows,
  normalizeInventoryRows,
  normalizeSku,
  skuFamilyToken,
  skuSegmentPrefixDepth,
  type InventoryRow,
} from "@/lib/operations/inventory";
import { fetchInventoryPage } from "@/lib/operations/syncInventory";

export type InventoryMatch = {
  sku: string;
  quantity: number;
  warehouse_name: string;
  category?: string;
};

export function inventoryRowToMatch(row: InventoryRow): InventoryMatch {
  return {
    sku: row.sku,
    quantity: row.available_quantity,
    warehouse_name: row.country,
    category: row.category || undefined,
  };
}

let cachedInventoryRows: InventoryRow[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Clear in-memory inventory cache after ops sync. */
export function clearInventoryLookupCache() {
  cachedInventoryRows = null;
  cacheExpiry = 0;
}

async function loadMetabaseInventoryRows(): Promise<InventoryRow[]> {
  const now = Date.now();
  if (cachedInventoryRows && now < cacheExpiry) {
    return cachedInventoryRows;
  }

  const response = await fetch(METABASE_INVENTORY_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch inventory feed (${response.status})`);
  }

  cachedInventoryRows = normalizeInventoryRows(await response.json());
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedInventoryRows;
}

function matchKey(row: InventoryMatch): string {
  return `${row.sku}::${row.warehouse_name}`;
}

function dedupeMatches(rows: InventoryMatch[]): InventoryMatch[] {
  const seen = new Set<string>();
  const out: InventoryMatch[] = [];
  for (const row of rows) {
    const key = matchKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function sortMatches(query: string, rows: InventoryMatch[]): InventoryMatch[] {
  const q = query.trim();
  return [...rows].sort((a, b) =>
    compareInventorySearch(
      {
        sku: a.sku,
        available_quantity: a.quantity,
        country: a.warehouse_name,
        category: a.category ?? "",
        user_id: "—",
        username: "—",
        product_name: "",
      },
      {
        sku: b.sku,
        available_quantity: b.quantity,
        country: b.warehouse_name,
        category: b.category ?? "",
        user_id: "—",
        username: "—",
        product_name: "",
      },
      q
    )
  );
}

function computeMatchedPrefix(query: string, matches: InventoryMatch[]): string | null {
  const norm = normalizeSku(query);
  if (!norm || matches.length === 0) return null;

  let bestDepth = 0;
  for (const match of matches) {
    bestDepth = Math.max(bestDepth, skuSegmentPrefixDepth(match.sku, query));
  }

  if (bestDepth > 0) {
    return norm.split("-").slice(0, bestDepth).join("-");
  }

  const token = skuFamilyToken(query);
  return token || null;
}

async function searchInventoryFromSupabase(
  query: string,
  limit: number
): Promise<InventoryMatch[]> {
  const { items } = await fetchInventoryPage(query, 1, limit);
  return items.map(inventoryRowToMatch);
}

async function searchInventoryFromMetabase(
  query: string,
  limit: number
): Promise<InventoryMatch[]> {
  const allRows = await loadMetabaseInventoryRows();
  return filterInventoryRows(allRows, query)
    .slice(0, limit)
    .map(inventoryRowToMatch);
}

/** Search warehouse inventory by SKU (Supabase cache + Metabase, merged). */
export async function searchInventoryMatches(
  query: string,
  options?: {
    /** When true, only rows with quantity > 0 are returned. */
    positiveQuantityOnly?: boolean;
    limit?: number;
  }
): Promise<{
  normalizedSku: string;
  matchedPrefix: string | null;
  matches: InventoryMatch[];
  source: "supabase" | "metabase" | "mixed";
}> {
  const normalizedSku = normalizeSku(query);
  const limit = options?.limit ?? 500;

  if (!normalizedSku) {
    return { normalizedSku: "", matchedPrefix: null, matches: [], source: "metabase" };
  }

  let supabaseMatches: InventoryMatch[] = [];
  let metabaseMatches: InventoryMatch[] = [];

  try {
    supabaseMatches = await searchInventoryFromSupabase(normalizedSku, limit);
  } catch {
    // Cache/RPC unavailable — Metabase below is the fallback.
  }

  try {
    metabaseMatches = await searchInventoryFromMetabase(normalizedSku, limit);
  } catch (error) {
    if (supabaseMatches.length === 0) throw error;
  }

  let matches = dedupeMatches(
    sortMatches(normalizedSku, [...supabaseMatches, ...metabaseMatches])
  ).slice(0, limit);

  if (options?.positiveQuantityOnly) {
    matches = matches.filter((row) => Number(row.quantity) > 0);
  }

  const source =
    supabaseMatches.length > 0 && metabaseMatches.length > 0
      ? "mixed"
      : supabaseMatches.length > 0
        ? "supabase"
        : "metabase";

  return {
    normalizedSku,
    matchedPrefix: computeMatchedPrefix(normalizedSku, matches),
    matches,
    source,
  };
}
