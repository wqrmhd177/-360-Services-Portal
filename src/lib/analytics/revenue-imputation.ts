import type { OrderLineItem } from "@/lib/types/order";

function normalizeTitle(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "No title";
}

function normalizeCountry(raw: string): string {
  const trimmed = raw?.trim();
  return trimmed || "Unknown";
}

export function titleCountryKey(title: string, country: string): string {
  return `${normalizeTitle(title)}\0${normalizeCountry(country)}`;
}

export function getResolvedPayable(line: OrderLineItem): number {
  if (line.resolvedPayable != null && !Number.isNaN(line.resolvedPayable)) {
    return line.resolvedPayable;
  }
  return line.totalPayable > 0 ? line.totalPayable : 0;
}

function compareLineItems(a: OrderLineItem, b: OrderLineItem): number {
  const dateDiff = a.orderDate.getTime() - b.orderDate.getTime();
  if (dateDiff !== 0) return dateDiff;
  if (a.metabaseId !== b.metabaseId) return a.metabaseId - b.metabaseId;
  return a.sku.localeCompare(b.sku);
}

/**
 * Chronological pass over all items: build last-known unit price per title+country,
 * assign resolvedPayable (actual or imputed) on each line.
 */
export function applyRevenueImputation(
  items: OrderLineItem[],
): OrderLineItem[] {
  const sorted = [...items].sort(compareLineItems);
  const lastUnit = new Map<string, number>();
  const resolvedByKey = new Map<string, { resolvedPayable: number; payableEstimated: boolean }>();

  for (const item of sorted) {
    const key = titleCountryKey(item.title, item.country);
    const lineKey = `${item.metabaseId}:${item.sku}`;

    if (item.totalPayable > 0 && item.quantity > 0) {
      const resolvedPayable = item.totalPayable;
      lastUnit.set(key, item.totalPayable / item.quantity);
      resolvedByKey.set(lineKey, {
        resolvedPayable,
        payableEstimated: false,
      });
      continue;
    }

    const unit = lastUnit.get(key);
    if (unit != null && item.quantity > 0) {
      resolvedByKey.set(lineKey, {
        resolvedPayable: unit * item.quantity,
        payableEstimated: true,
      });
    } else {
      resolvedByKey.set(lineKey, {
        resolvedPayable: 0,
        payableEstimated: false,
      });
    }
  }

  return items.map((item) => {
    const lineKey = `${item.metabaseId}:${item.sku}`;
    const resolved = resolvedByKey.get(lineKey);
    if (!resolved) {
      return {
        ...item,
        resolvedPayable: item.totalPayable > 0 ? item.totalPayable : 0,
        payableEstimated: false,
      };
    }
    return {
      ...item,
      resolvedPayable: resolved.resolvedPayable,
      payableEstimated: resolved.payableEstimated,
    };
  });
}
