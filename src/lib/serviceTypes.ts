/** Service types that use the Zambeel 360 form and logic (multi-country, product-based). */
export const ZAMBEEL_LIKE_SERVICES = [
  "Zambeel 360",
  "DS2",
  "DS3",
  "DS4",
  "Partner Stores",
  "Amazon",
  "GOLD",
] as const;

export function isZambeelLikeService(service: string): boolean {
  return (ZAMBEEL_LIKE_SERVICES as readonly string[]).includes(service);
}

/** Service types that use the logistics carton form. */
export const LOGISTICS_SERVICES = ["Logistics Only", "3PL & Logistics"] as const;

export function isLogisticsService(service: string): boolean {
  return (LOGISTICS_SERVICES as readonly string[]).includes(service);
}

/** Interim v1: Movements uses Sourcing-only QR rules until dedicated workflow exists. */
export function isMovementsService(service: string): boolean {
  return service === "Movements";
}

export function isSourcingService(service: string): boolean {
  return (
    isZambeelLikeService(service) ||
    service === "Sourcing & Logistics" ||
    service === "Sourcing only" ||
    isMovementsService(service)
  );
}

/** PR finance verification is skipped for these services (auto-verified on approver approve). */
export const FINANCE_SKIP_SERVICES = [
  "DS2",
  "DS3",
  "Partner Stores",
  "GOLD",
] as const;

export function isFinanceSkipService(service: string | null | undefined): boolean {
  const s = (service ?? "").trim();
  return (FINANCE_SKIP_SERVICES as readonly string[]).includes(s);
}

export function isFinanceVerificationRequired(service: string | null | undefined): boolean {
  return !isFinanceSkipService(service);
}

/** All selectable service options (single source for dropdowns). */
export const ALL_SERVICE_OPTIONS = [
  "Zambeel 360",
  "DS2",
  "DS3",
  "DS4",
  "Partner Stores",
  "Amazon",
  "GOLD",
  "Movements",
  "Sourcing & Logistics",
  "Sourcing only",
  "Logistics Only",
  "3PL & Logistics",
] as const;

/** Service types that Finance groups as "Zambeel Services". */
export const ZAMBEEL_SERVICES = [
  "Zambeel 360",
  "Sourcing & Logistics",
  "Sourcing only",
  "Logistics Only",
  "3PL & Logistics",
  "GOLD",
] as const;

export type ServiceGroup = "zambeel" | "wholesale" | "unknown";

export function getServiceGroup(serviceType: string | null | undefined): ServiceGroup {
  const s = (serviceType ?? "").trim();
  if (!s) return "unknown";
  if ((ZAMBEEL_SERVICES as readonly string[]).includes(s)) return "zambeel";
  return "wholesale";
}
