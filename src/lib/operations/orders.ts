export const METABASE_ORDERS_URL =
  "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json";

export interface OrderRow {
  orderId: number;
  orderNumber: string;
  domain: string;
  storeId: number;
  storeUrl: string;
  country: string;
  city: string;
  title: string;
  sku: string;
  quantity: number;
  totalPayable: number;
  currency: string;
  status: string;
  substatus: string;
  tag: string;
  bifurcation: string;
  deliveryPartner: string;
  platform: string;
  orderDate: Date | null;
  approvedDate: Date | null;
  shipmentDate: Date | null;
  shipmentDateLog: Date | null;
  deliveredDate: Date | null;
  returnedDate: Date | null;
  undeliveredDate: Date | null;
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function normalizeOrderRows(raw: unknown[]): OrderRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r_) => {
    const r = r_ as Record<string, unknown>;
    return {
      orderId: Number(r.id ?? 0),
      orderNumber: String(r.order_number ?? ""),
      domain: String(r.domain ?? ""),
      storeId: Number(r.store_id ?? 0),
      storeUrl: String(r.store_url ?? ""),
      country: String(r.country ?? ""),
      city: String(r.city ?? ""),
      title: String(r.title ?? ""),
      sku: String(r.sku ?? ""),
      quantity: Number(r.quantity ?? 1),
      totalPayable: Number(r.total_payable ?? 0),
      currency: String(r.currency ?? ""),
      status: String(r.status ?? ""),
      substatus: String(r.substatus ?? ""),
      tag: String(r.tag ?? ""),
      bifurcation: String(r.bifurcation ?? ""),
      deliveryPartner: String(r.delivery_partner ?? ""),
      platform: String(r.platform ?? ""),
      orderDate: parseDate(r.Order_date as string | null),
      approvedDate: parseDate(r.approved_date as string | null),
      shipmentDate: parseDate(r.shipment_date as string | null),
      shipmentDateLog: parseDate(r.shipment_date_log as string | null),
      deliveredDate: parseDate(r.delivered_date as string | null),
      returnedDate: parseDate(r.Returned_date as string | null),
      undeliveredDate: parseDate(r.Undelivered_date as string | null),
    };
  });
}

export function normalizeDbOrderRows(rows: unknown[]): OrderRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r_) => {
    const r = r_ as Record<string, unknown>;
    return {
      orderId: Number(r.order_id ?? 0),
      orderNumber: String(r.order_number ?? ""),
      domain: String(r.domain ?? ""),
      storeId: Number(r.store_id ?? 0),
      storeUrl: String(r.store_url ?? ""),
      country: String(r.country ?? ""),
      city: String(r.city ?? ""),
      title: String(r.title ?? ""),
      sku: String(r.sku ?? ""),
      quantity: Number(r.quantity ?? 1),
      totalPayable: Number(r.total_payable ?? 0),
      currency: String(r.currency ?? ""),
      status: String(r.status ?? ""),
      substatus: String(r.substatus ?? ""),
      tag: String(r.tag ?? ""),
      bifurcation: String(r.bifurcation ?? ""),
      deliveryPartner: String(r.delivery_partner ?? ""),
      platform: String(r.platform ?? ""),
      orderDate: r.order_date ? new Date(String(r.order_date)) : null,
      approvedDate: r.approved_date ? new Date(String(r.approved_date)) : null,
      shipmentDate: r.shipment_date ? new Date(String(r.shipment_date)) : null,
      shipmentDateLog: r.shipment_date_log ? new Date(String(r.shipment_date_log)) : null,
      deliveredDate: r.delivered_date ? new Date(String(r.delivered_date)) : null,
      returnedDate: r.returned_date ? new Date(String(r.returned_date)) : null,
      undeliveredDate: r.undelivered_date ? new Date(String(r.undelivered_date)) : null,
    };
  });
}
