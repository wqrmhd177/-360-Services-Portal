/**
 * Canonical country names for Operations filters and analytics.
 * Metabase may use UAE, United Arab Emirates, KSA, Saudi Arabia, etc. — treat as one.
 */

export type CountryCanonical = "United Arab Emirates" | "Saudi Arabia";

type CountryGroup = {
  canonical: CountryCanonical;
  aliases: readonly string[];
};

const COUNTRY_GROUPS: readonly CountryGroup[] = [
  {
    canonical: "United Arab Emirates",
    aliases: ["UAE", "United Arab Emirates", "U.A.E.", "U.A.E"],
  },
  {
    canonical: "Saudi Arabia",
    aliases: ["KSA", "Saudi Arabia", "Saudia Arabia", "Kingdom of Saudi Arabia"],
  },
];

const ALIAS_TO_CANONICAL = new Map<string, string>(
  COUNTRY_GROUPS.flatMap((group) =>
    group.aliases.map((alias) => [alias.trim().toLowerCase(), group.canonical]),
  ),
);

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Normalize raw Metabase / DB country to a canonical label for filters and rollups. */
export function normalizeOrderCountry(raw: string | undefined | null): string {
  const trimmed = collapseWhitespace(raw ?? "");
  if (!trimmed) return "Unknown";

  const key = trimmed.toLowerCase();
  const exact = ALIAS_TO_CANONICAL.get(key);
  if (exact) return exact;

  // Fuzzy fallbacks for minor typos / spacing variants in Metabase exports.
  if (
    key === "uae" ||
    key.includes("united arab emirates") ||
    key.replace(/\./g, "") === "uae"
  ) {
    return "United Arab Emirates";
  }

  if (
    key === "ksa" ||
    key.includes("saudi arabia") ||
    key.includes("saudia arabia") ||
    key.includes("kingdom of saudi arabia")
  ) {
    return "Saudi Arabia";
  }

  return trimmed;
}

/** All DB values that should match a filter selection (for PostgREST `.in()`). */
export function countryFilterVariants(filter: string | null | undefined): string[] {
  const trimmed = filter?.trim();
  if (!trimmed) return [];

  const canonical = normalizeOrderCountry(trimmed);
  const group = COUNTRY_GROUPS.find((g) => g.canonical === canonical);
  if (!group) return [trimmed];

  return [...new Set([canonical, trimmed, ...group.aliases])];
}

/** Dedupe a raw country list for filter dropdowns (one entry per canonical country). */
export function dedupeCountryFilterOptions(countries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of countries) {
    const canonical = normalizeOrderCountry(raw);
    if (!canonical || canonical === "Unknown") continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }

  return result.sort((a, b) => a.localeCompare(b));
}

/** Normalize filter param before sending to Supabase RPCs. */
export function normalizeCountryFilterParam(
  country: string | null | undefined,
): string | null {
  const trimmed = country?.trim();
  if (!trimmed) return null;
  return normalizeOrderCountry(trimmed);
}
