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
