export const DELIVERY_PARTNER_CHART_BLANK = "Blank";
export const DELIVERY_PARTNER_CHART_UNKNOWN = "Unknown";
export const DELIVERY_PARTNER_CHART_UNASSIGNED = "Unassigned";

/** Chart bucket for delivery partner (order-level). */
export function resolveDeliveryPartnerChartLabel(
  deliveryPartner: string | null | undefined,
  courierTrackingId: string | null | undefined,
): string {
  const partner = deliveryPartner?.trim() ?? "";
  const tracking = courierTrackingId?.trim() ?? "";
  const hasTracking = tracking.length > 0;

  if (hasTracking) {
    if (!partner) return DELIVERY_PARTNER_CHART_BLANK;
    if (partner.toLowerCase() === "unknown") return DELIVERY_PARTNER_CHART_UNKNOWN;
    return partner;
  }

  if (!partner) return DELIVERY_PARTNER_CHART_UNASSIGNED;
  if (partner.toLowerCase() === "unknown") return DELIVERY_PARTNER_CHART_UNKNOWN;
  return partner;
}
