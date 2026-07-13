export interface RevenueLossTagGroupConfig {
  heading: string;
  /** Normalized tag labels matched to this heading */
  tagPatterns: readonly string[];
}

/** Clubbed Revenue Loss tag headings → member tags (case-insensitive match). */
export const REVENUE_LOSS_TAG_GROUPS: readonly RevenueLossTagGroupConfig[] = [
  {
    heading: "Uncontactable Cancelled",
    tagPatterns: [
      "uncontactable (no response)",
      "uncontactable (no reponse)",
      "customer not reachable/no response",
      "customer not reachable/no reponse",
      "cutomer not reachable/no reponse",
      "customer stopped responding mags/calls",
      "customer stopped responding msgs/ calls",
      "cst hang up the call",
      "cst hang-up the call",
    ],
  },
  {
    heading: "Connected Cancelled",
    tagPatterns: [
      "customer cancelled the order",
      "cancelled by customer",
      "change of mind",
      "chnage of mind",
      "did not order",
      "does not want to give reason",
      "long reschedule",
      "not available/travelling",
      "no cash",
      "package discrepancy",
      "open package request",
      "order form other store/cheaper/warranty issue",
      "price issue",
    ],
  },
  {
    heading: "Seller issue",
    tagPatterns: [
      "invalid order",
      "invalid number",
      "duplicate order",
      "test/fake order",
      "on internal team request",
      "on sellers request",
      "wrong number",
      "product not available",
    ],
  },
  {
    heading: "Ops Issue",
    tagPatterns: ["item lost", "no service area"],
  },
] as const;

export function normalizeRevenueLossTagKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const TAG_TO_GROUP_HEADING = new Map<string, string>();

for (const group of REVENUE_LOSS_TAG_GROUPS) {
  for (const pattern of group.tagPatterns) {
    TAG_TO_GROUP_HEADING.set(normalizeRevenueLossTagKey(pattern), group.heading);
  }
}

export function getRevenueLossTagGroupHeading(tag: string): string | null {
  return TAG_TO_GROUP_HEADING.get(normalizeRevenueLossTagKey(tag)) ?? null;
}
