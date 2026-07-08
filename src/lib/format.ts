import { getPurchaseDetailLabel } from "@/lib/qrPurchaseDetails";
export function formatQrStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (s === "converted_to_pr") return "Converted to PR";
  const withSpaces = s.replace(/_/g, " ");
  if (!withSpaces) return "—";
  return withSpaces
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Format date as DD/MM/YYYY */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Format time as HH:MM AM/PM */
export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");
  return `${hoursStr}:${minutes} ${ampm}`;
}

/** Get currency based on destination country */
export function getCurrencyForCountry(country: string): string {
  if (!country) return "AED";
  const countryLower = country.toLowerCase();
  if (countryLower.includes("saudi") || countryLower === "saudi arabia") {
    return "SAR";
  }
  if (countryLower.includes("pakistan") || countryLower === "pakistan") {
    return "PKR";
  }
  return "AED";
}

/** Format price with commas and currency */
export function formatTargetPrice(price: number | undefined, country: string): string {
  if (!price) return "-";
  const currency = getCurrencyForCountry(country);
  return `${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** Human-readable status label from snake_case */
export function formatStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (!s) return "—";
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Summarize destination countries from purchase details */
export function summarizeDestinations(purchaseDetails: Array<{
  destinationCountries?: string[];
  destinationCountry?: string;
}> | null | undefined): string {
  if (!purchaseDetails?.length) return "—";
  const all = new Set<string>();
  for (const detail of purchaseDetails) {
    if (detail.destinationCountries?.length) {
      detail.destinationCountries.forEach((c) => all.add(c));
    } else if (detail.destinationCountry) {
      all.add(detail.destinationCountry);
    }
  }
  const list = Array.from(all);
  if (list.length === 0) return "—";
  if (list.length <= 2) return list.join(", ");
  return `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
}

/** First product name with optional count suffix */
export function summarizeProducts(
  purchaseDetails: Array<{ productName?: string; fromSku?: string; toSku?: string }> | null | undefined
): string {
  if (!purchaseDetails?.length) return "—";
  const first = getPurchaseDetailLabel(purchaseDetails[0] ?? {});
  if (purchaseDetails.length === 1) return first;
  return `${first} (+${purchaseDetails.length - 1} more)`;
}

/** PR product summary */
export function summarizePrProduct(pr: {
  product_name?: string;
  products?: Array<{ productName?: string }>;
}): string {
  if (pr.products?.length) {
    const first = pr.products[0]?.productName || "—";
    return pr.products.length === 1 ? first : `${first} (+${pr.products.length - 1} more)`;
  }
  return pr.product_name || "—";
}

/** PR total amount display */
export function formatPrAmount(pr: {
  amount?: number;
  products?: Array<{ totalAmount?: number }>;
}): string {
  if (pr.amount != null && pr.amount > 0) {
    return pr.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (pr.products?.length) {
    const total = pr.products.reduce((s, p) => s + (p.totalAmount || 0), 0);
    if (total > 0) {
      return total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  return "—";
}

/** Seller name from PR */
export function getPrSeller(pr: {
  seller_channel_name?: string;
  reseller_code?: string;
}): string {
  return pr.seller_channel_name || pr.reseller_code || "—";
}
