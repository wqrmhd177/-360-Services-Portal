import { METABASE_INVENTORY_URL } from "@/lib/constants";
import {
  normalizeInventoryRows,
  normalizeSku,
  skuFamilyToken,
  skuSegmentPrefixDepth,
  type InventoryRow,
} from "@/lib/operations/inventory";

export type InventorySku = {
  sku: string;
  country: string;
  quantity: number;
  sku_type: string;
};

let cachedInventory: InventorySku[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

function rowToSku(row: InventoryRow): InventorySku {
  return {
    sku: row.sku,
    country: row.country,
    quantity: row.available_quantity,
    sku_type: row.category,
  };
}

async function loadInventory(): Promise<InventorySku[]> {
  const now = Date.now();
  if (cachedInventory && now < cacheExpiry) {
    return cachedInventory;
  }

  const res = await fetch(METABASE_INVENTORY_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory: ${res.status}`);
  }

  const raw = await res.json();
  cachedInventory = normalizeInventoryRows(raw).map(rowToSku);
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedInventory;
}

function skuMatchesPrefix(item: InventorySku, query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  const norm = normalizeSku(q);
  const token = skuFamilyToken(q).toLowerCase();
  const sku = item.sku;
  const skuLower = sku.toLowerCase();

  if (sku === norm) return true;
  if (skuLower.startsWith(norm.toLowerCase())) return true;
  if (norm.toLowerCase().startsWith(skuLower)) return true;
  if (skuLower.includes(norm.toLowerCase())) return true;
  if (token && skuFamilyToken(sku).toLowerCase().startsWith(token)) return true;
  return skuLower.startsWith(q.toLowerCase());
}

function compareSkuSearch(a: InventorySku, b: InventorySku, query: string): number {
  const norm = normalizeSku(query);
  const rank = (item: InventorySku) => {
    const sku = item.sku;
    if (sku === norm) return 0;
    if (sku.startsWith(norm)) return 1;
    if (norm.startsWith(sku)) return 2;
    if (sku.includes(norm)) return 3;
    return 4;
  };
  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) return rankDiff;
  const depthDiff = skuSegmentPrefixDepth(b.sku, query) - skuSegmentPrefixDepth(a.sku, query);
  if (depthDiff !== 0) return depthDiff;
  return a.sku.localeCompare(b.sku);
}

export async function searchSkus(
  prefix: string,
  minLength = 3,
  limit = 20,
): Promise<InventorySku[]> {
  const q = prefix.trim();
  if (q.length < minLength) return [];

  const inventory = await loadInventory();
  return inventory
    .filter((item) => skuMatchesPrefix(item, q))
    .sort((a, b) => compareSkuSearch(a, b, q))
    .slice(0, limit);
}

export async function getSkuExact(sku: string): Promise<InventorySku | null> {
  const inventory = await loadInventory();
  const norm = normalizeSku(sku);
  return inventory.find((item) => item.sku === norm || item.sku === sku.trim()) ?? null;
}

export { METABASE_INVENTORY_URL };
