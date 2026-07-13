/**
 * Country → local currency for order totals (total_payable is in local currency).
 * Dashboard displays everything converted to USD.
 */

export type CurrencyCode =
  | "USD"
  | "KWD"
  | "AED"
  | "SAR"
  | "QAR"
  | "OMR"
  | "BHD"
  | "PKR"
  | "IQD";

/** 1 unit of local currency = this many USD */
const DEFAULT_RATES_TO_USD: Record<CurrencyCode, number> = {
  USD: 1,
  KWD: 3.27,
  AED: 0.272294,
  SAR: 0.266667,
  QAR: 0.274725,
  OMR: 2.597403,
  BHD: 2.65252,
  PKR: 0.00359,
  IQD: 0.00076,
};

const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  Kuwait: "KWD",
  KWT: "KWD",
  "United Arab Emirates": "AED",
  UAE: "AED",
  "Saudi Arabia": "SAR",
  KSA: "SAR",
  Qatar: "QAR",
  QTR: "QAR",
  QA: "QAR",
  Oman: "OMR",
  OMN: "OMR",
  Bahrain: "BHD",
  BHR: "BHD",
  Pakistan: "PKR",
  PAK: "PKR",
  Karachi: "PKR",
  Iraq: "IQD",
  IRQ: "IQD",
};

function loadRatesFromEnv(): Partial<Record<CurrencyCode, number>> {
  const raw = process.env.EXCHANGE_RATES_TO_USD_JSON;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<Record<CurrencyCode, number>>;
  } catch {
    console.warn("Invalid EXCHANGE_RATES_TO_USD_JSON, using defaults");
    return {};
  }
}

const envRates = loadRatesFromEnv();

export function getRatesToUsd(): Record<CurrencyCode, number> {
  return { ...DEFAULT_RATES_TO_USD, ...envRates };
}

/** Infer currency from SKU suffix when country label is ambiguous */
function currencyFromSku(sku: string): CurrencyCode | null {
  if (sku.endsWith("-KWT") || sku.includes("-KWT-")) return "KWD";
  if (sku.endsWith("-KSA") || sku.includes("-KSA-")) return "SAR";
  if (sku.endsWith("-QTR") || sku.includes("-QTR-")) return "QAR";
  if (sku.endsWith("-OMN") || sku.includes("-OMN-")) return "OMR";
  if (sku.endsWith("-BHR") || sku.includes("-BHR-")) return "BHD";
  if (sku.endsWith("-PAK") || sku.includes("-PAK-")) return "PKR";
  if (sku.endsWith("-IRQ") || sku.includes("-IRQ-")) return "IQD";
  if (sku.endsWith("-ZAM") && !sku.match(/-(KWT|KSA|QTR|OMN|BHR|PAK|IRQ)/))
    return "AED"; // base Zambeel SKU often UAE-priced
  return null;
}

export function getCurrencyForCountry(
  country: string,
  sku?: string
): CurrencyCode {
  const normalized = country?.trim();
  if (normalized && COUNTRY_CURRENCY[normalized]) {
    return COUNTRY_CURRENCY[normalized];
  }
  const lower = normalized?.toLowerCase() ?? "";
  for (const [key, code] of Object.entries(COUNTRY_CURRENCY)) {
    if (key.toLowerCase() === lower) return code;
  }
  if (sku) {
    const fromSku = currencyFromSku(sku);
    if (fromSku) return fromSku;
  }
  return "USD";
}

export function convertToUsd(
  amount: number,
  country: string,
  sku?: string,
  currencyOverride?: string
): number {
  if (!amount || Number.isNaN(amount)) return 0;
  if (currencyOverride) {
    const code = currencyOverride.toUpperCase() as CurrencyCode;
    const rate = getRatesToUsd()[code];
    if (rate != null) return amount * rate;
  }
  const currency = getCurrencyForCountry(country, sku);
  const rate = getRatesToUsd()[currency] ?? 1;
  return amount * rate;
}

export function getCountryCurrencyLabel(country: string, sku?: string): string {
  return getCurrencyForCountry(country, sku);
}

export const DISPLAY_COUNTRY_CURRENCIES: { country: string; currency: CurrencyCode }[] = [
  { country: "Kuwait", currency: "KWD" },
  { country: "United Arab Emirates", currency: "AED" },
  { country: "Saudi Arabia", currency: "SAR" },
  { country: "Qatar", currency: "QAR" },
  { country: "Oman", currency: "OMR" },
  { country: "Bahrain", currency: "BHD" },
  { country: "Pakistan", currency: "PKR" },
  { country: "Iraq", currency: "IQD" },
];
