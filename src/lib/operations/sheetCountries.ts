import { normalizeOrderCountry } from "@/lib/country-normalization";

/** Fixed country filter for Overall / OP / Ticketing analytics tabs. */
export const SHEET_ANALYTICS_COUNTRIES = [
  { code: "UAE", label: "UAE" },
  { code: "KSA", label: "KSA" },
  { code: "Qatar", label: "Qatar" },
  { code: "Oman", label: "Oman" },
  { code: "Bahrain", label: "Bahrain" },
  { code: "Iraq", label: "Iraq" },
  { code: "PAK", label: "PAK" },
  { code: "Kuwait", label: "Kuwait" },
  { code: "USA", label: "USA" },
] as const;

export type SheetAnalyticsCountryCode =
  (typeof SHEET_ANALYTICS_COUNTRIES)[number]["code"];

const CODE_TO_CANONICAL: Record<SheetAnalyticsCountryCode, string> = {
  UAE: "United Arab Emirates",
  KSA: "Saudi Arabia",
  Qatar: "Qatar",
  Oman: "Oman",
  Bahrain: "Bahrain",
  Iraq: "Iraq",
  PAK: "Pakistan",
  Kuwait: "Kuwait",
  USA: "United States",
};

export function parseSheetCountryParam(
  raw: string | string[] | undefined,
): SheetAnalyticsCountryCode | "" {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.toLowerCase() === "all") return "";
  const upper = value.toUpperCase();
  const match = SHEET_ANALYTICS_COUNTRIES.find(
    (c) => c.code.toUpperCase() === upper || c.label.toUpperCase() === upper,
  );
  if (match) return match.code;

  const canonical = normalizeOrderCountry(value);
  const byCanonical = (
    Object.entries(CODE_TO_CANONICAL) as Array<[SheetAnalyticsCountryCode, string]>
  ).find(([, name]) => name === canonical);
  return byCanonical?.[0] ?? "";
}

/** Canonical name used in SQL `normalize_ops_country` comparisons. */
export function sheetCountryCanonical(
  code: SheetAnalyticsCountryCode | "",
): string | null {
  if (!code) return null;
  return CODE_TO_CANONICAL[code];
}

export function parseOptionalDateParam(
  raw: string | string[] | undefined,
): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
