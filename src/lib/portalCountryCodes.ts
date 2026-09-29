export const PORTAL_COUNTRY_CODES = [
  "UAE",
  "KSA",
  "QTR",
  "KWT",
  "OMN",
  "BHR",
  "IRQ",
  "USA",
  "PAK",
] as const;

export type PortalCountryCode = (typeof PORTAL_COUNTRY_CODES)[number];

const PORTAL_CODE_SET = new Set<string>(PORTAL_COUNTRY_CODES);

export function isPortalCountryCode(value: string): value is PortalCountryCode {
  return PORTAL_CODE_SET.has(value);
}

export const PORTAL_COUNTRY_LABELS: Record<PortalCountryCode, string> = {
  UAE: "UAE",
  KSA: "KSA",
  QTR: "QTR",
  KWT: "KWT",
  OMN: "OMN",
  BHR: "BHR",
  IRQ: "IRQ",
  USA: "USA",
  PAK: "PAK",
};

/** Full country names used on product listing supplier forms. */
export const PORTAL_CODE_TO_LISTING_COUNTRY: Record<PortalCountryCode, string> = {
  UAE: "United Arab Emirates",
  KSA: "Saudi Arabia",
  QTR: "Qatar",
  KWT: "Kuwait",
  OMN: "Oman",
  BHR: "Bahrain",
  IRQ: "Iraq",
  USA: "United States",
  PAK: "Pakistan",
};
