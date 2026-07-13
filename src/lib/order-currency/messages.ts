import { DISPLAY_COUNTRY_CURRENCIES } from "@/lib/order-currency";

const countryList = DISPLAY_COUNTRY_CURRENCIES.map(
  (c) => `${c.country} (${c.currency})`
).join(" · ");

export const REVENUE_USD_INFO_HEADING = "All revenue figures are shown in USD";

export const REVENUE_USD_INFO_BODY = `Order values are converted from local currency by country: ${countryList}. Configure rates in EXCHANGE_RATES_TO_USD_JSON. Lines with zero total_payable use the most recent unit price for the same product title and country in loaded order history.`;

export const REVENUE_USD_INFO_FULL = `${REVENUE_USD_INFO_HEADING}\n\n${REVENUE_USD_INFO_BODY}`;

/** Full text shown under Orders page titles (not abbreviated) */
export const REVENUE_USD_SUMMARY = `${REVENUE_USD_INFO_HEADING}. ${REVENUE_USD_INFO_BODY}`;
