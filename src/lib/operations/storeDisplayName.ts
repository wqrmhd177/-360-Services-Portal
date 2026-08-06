const TRAILING_DATE_PATTERNS = [
  /\s+-\s+\d{1,2}-[A-Za-z]{3}-\d{4}$/,
  /\s+-\s+\d{1,2}-[A-Za-z]\S*$/,
  /\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-?\d{4}$/i,
  /\s+\d{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/i,
];

/** Display store name without trailing Metabase date suffixes (e.g. "Jun-2026"). */
export function formatStoreDisplayName(name: string | null | undefined): string {
  if (!name) return "—";
  let cleaned = name.trim();
  if (!cleaned) return "—";

  for (const pattern of TRAILING_DATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  return cleaned || name.trim();
}
