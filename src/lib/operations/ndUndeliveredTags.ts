/** Only these undelivered tags count toward ND Undelivered qty (case-insensitive). */
export const ND_UNDELIVERED_FA_TAGS = [
  "fa - request to return",
  "fa - hold for working",
] as const;

export function normalizeOrderTag(tag: unknown): string {
  return tag == null ? "" : String(tag).trim();
}

/** Undelivered qty: status Undelivered AND tag is FA - Request to Return or FA - Hold for Working only. */
export function isNdUndeliveredLine(status: string, tag: unknown): boolean {
  if (status !== "Undelivered") return false;

  const lower = normalizeOrderTag(tag).toLowerCase();
  return ND_UNDELIVERED_FA_TAGS.includes(lower as (typeof ND_UNDELIVERED_FA_TAGS)[number]);
}
