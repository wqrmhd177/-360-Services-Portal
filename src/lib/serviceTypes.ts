/** Service types that use the Zambeel 360 form and logic (multi-country, product-based). */
export const ZAMBEEL_LIKE_SERVICES = [
  "Zambeel 360",
  "DS2",
  "DS3",
  "DS4",
  "Partner Stores",
  "Amazon",
] as const;

export function isZambeelLikeService(service: string): boolean {
  return (ZAMBEEL_LIKE_SERVICES as readonly string[]).includes(service);
}

/** Service types that use the logistics carton form. */
export const LOGISTICS_SERVICES = ["Logistics Only", "3PL & Logistics"] as const;

export function isLogisticsService(service: string): boolean {
  return (LOGISTICS_SERVICES as readonly string[]).includes(service);
}

export function isSourcingService(service: string): boolean {
  return (
    isZambeelLikeService(service) ||
    service === "Sourcing & Logistics" ||
    service === "Sourcing only"
  );
}

/** Service types that Finance groups as "Zambeel Services". */
export const ZAMBEEL_SERVICES = [
  "Zambeel 360",
  "Sourcing & Logistics",
  "Sourcing only",
  "Logistics Only",
  "3PL & Logistics",
] as const;

export type ServiceGroup = "zambeel" | "wholesale" | "unknown";

export function getServiceGroup(serviceType: string | null | undefined): ServiceGroup {
  const s = (serviceType ?? "").trim();
  if (!s) return "unknown";
  if ((ZAMBEEL_SERVICES as readonly string[]).includes(s)) return "zambeel";
  return "wholesale";
}
