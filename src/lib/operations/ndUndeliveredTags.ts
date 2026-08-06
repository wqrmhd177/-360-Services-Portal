/** FA undelivered tags that must be included in ND Undelivered qty (case-insensitive). */
export const ND_UNDELIVERED_FA_TAGS = [
  "fa - request to return",
  "fa - hold for working",
] as const;

export function normalizeOrderTag(tag: unknown): string {
  return tag == null ? "" : String(tag).trim();
}

/** Undelivered line counts when status is Undelivered and tag passes FA rules. */
export function isNdUndeliveredLine(status: string, tag: unknown): boolean {
  if (status !== "Undelivered") return false;

  const t = normalizeOrderTag(tag);
  if (!t) return true;

  const lower = t.toLowerCase();
  if (ND_UNDELIVERED_FA_TAGS.includes(lower as (typeof ND_UNDELIVERED_FA_TAGS)[number])) {
    return true;
  }

  return !t.toUpperCase().startsWith("FA");
}
