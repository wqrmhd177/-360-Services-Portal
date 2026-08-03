import {
  searchInventoryMatches,
  type InventoryMatch,
} from "@/lib/inventoryLookup";

export type InventorySku = {
  sku: string;
  country: string;
  quantity: number;
  sku_type: string;
};

let cachedSearchResults: Map<string, { expiry: number; results: InventorySku[] }> = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function matchToSku(match: InventoryMatch): InventorySku {
  return {
    sku: match.sku,
    country: match.warehouse_name,
    quantity: match.quantity,
    sku_type: match.category ?? "",
  };
}

function getCached(key: string): InventorySku[] | null {
  const entry = cachedSearchResults.get(key);
  if (!entry || Date.now() >= entry.expiry) {
    cachedSearchResults.delete(key);
    return null;
  }
  return entry.results;
}

function setCached(key: string, results: InventorySku[]) {
  cachedSearchResults.set(key, {
    results,
    expiry: Date.now() + CACHE_TTL_MS,
  });
}

/** Clear in-memory SKU cache after a fresh inventory sync. */
export function clearInventorySkuCache() {
  cachedSearchResults.clear();
}

export async function searchSkus(
  prefix: string,
  minLength = 3,
  limit = 20,
): Promise<InventorySku[]> {
  const q = prefix.trim();
  if (q.length < minLength) return [];

  const cacheKey = `${q.toLowerCase()}::${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const result = await searchInventoryMatches(q, { limit });
  const skus = result.matches.slice(0, limit).map(matchToSku);
  setCached(cacheKey, skus);
  return skus;
}

export async function getSkuExact(sku: string): Promise<InventorySku | null> {
  const result = await searchInventoryMatches(sku, { limit: 50 });
  const norm = sku.trim().toUpperCase().replace(/^,+/, "");
  const exact = result.matches.find(
    (item) => item.sku === norm || item.sku === sku.trim()
  );
  return exact ? matchToSku(exact) : null;
}

export { METABASE_INVENTORY_URL } from "@/lib/constants";
