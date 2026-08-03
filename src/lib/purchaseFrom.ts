export const PURCHASE_FROM_OPTIONS = [
  "China",
  "Local KSA Market",
  "Local UAE Market",
  "Local PAK Market",
] as const;

export type PurchaseFromOption = (typeof PURCHASE_FROM_OPTIONS)[number];

/** Normalize legacy values when loading saved QR/procurement data. */
export function normalizePurchaseFrom(value: string | null | undefined): PurchaseFromOption {
  const v = (value ?? "").trim();
  if (v === "Local Market") return "Local KSA Market";
  if ((PURCHASE_FROM_OPTIONS as readonly string[]).includes(v)) {
    return v as PurchaseFromOption;
  }
  return "China";
}
