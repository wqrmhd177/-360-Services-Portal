const METABASE_INVENTORY_URL =
  "https://zambeel.metabaseapp.com/public/question/1baaf009-da23-4baf-8dad-8e2657498666.json";

export type InventorySku = {
  sku: string;
  country: string;
  quantity: number;
  sku_type: string;
};

let cachedInventory: InventorySku[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function loadInventory(): Promise<InventorySku[]> {
  const now = Date.now();
  if (cachedInventory && now < cacheExpiry) {
    return cachedInventory;
  }

  const res = await fetch(METABASE_INVENTORY_URL, { next: { revalidate: 900 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory: ${res.status}`);
  }

  const data = (await res.json()) as InventorySku[];
  cachedInventory = Array.isArray(data) ? data : [];
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedInventory;
}

export async function searchSkus(
  prefix: string,
  minLength = 3,
  limit = 20
): Promise<InventorySku[]> {
  const q = prefix.trim().toLowerCase();
  if (q.length < minLength) return [];

  const inventory = await loadInventory();
  return inventory
    .filter((item) => item.sku.toLowerCase().startsWith(q))
    .slice(0, limit);
}

export async function getSkuExact(sku: string): Promise<InventorySku | null> {
  const inventory = await loadInventory();
  return inventory.find((item) => item.sku === sku) ?? null;
}
