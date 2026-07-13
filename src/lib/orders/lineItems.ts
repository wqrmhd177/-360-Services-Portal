import { getOpsDb } from "@/lib/operations/opsDb";
import type { OrderLineItem } from "@/lib/types/order";

type DbOrderRow = {
  order_id: number | null;
  order_number: string | null;
  domain: string | null;
  store_id: number | null;
  store_url: string | null;
  country: string | null;
  city: string | null;
  full_name: string | null;
  title: string | null;
  sku: string | null;
  quantity: number | null;
  total_payable: number | null;
  currency: string | null;
  status: string | null;
  substatus: string | null;
  tag: string | null;
  bifurcation: string | null;
  delivery_partner: string | null;
  platform: string | null;
  order_date: string | null;
  approved_date: string | null;
  shipment_date: string | null;
  shipment_date_log: string | null;
  delivered_date: string | null;
  returned_date: string | null;
  undelivered_date: string | null;
};

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapDbRowToOrderLineItem(row: DbOrderRow): OrderLineItem | null {
  const orderDate = parseDate(row.order_date);
  if (!orderDate) return null;

  const accountManager =
    row.domain?.trim() ||
    row.store_url?.trim() ||
    (row.store_id != null ? `Store ${row.store_id}` : "Unknown");

  return {
    metabaseId: Number(row.order_id ?? 0),
    orderNumber: row.order_number ?? "",
    country: row.country ?? "",
    fullName: row.full_name ?? "",
    phone: "",
    shipping: "",
    city: row.city ?? "",
    title: row.title ?? "",
    sku: row.sku ?? "",
    quantity: Number(row.quantity ?? 1),
    totalPayable: Number(row.total_payable ?? 0),
    status: row.status ?? "",
    substatus: row.substatus ?? "",
    tag: row.tag ?? "",
    opRemarks: "",
    bifurcation: row.bifurcation ?? "",
    platform: row.platform ?? "",
    accountManager,
    deliveryPartner: row.delivery_partner ?? "",
    undeliveredTag: null,
    courierTrackingId: "",
    orderDate,
    deliveredDate: parseDate(row.delivered_date),
    shipmentDate: parseDate(row.shipment_date),
    shipmentDateLog: parseDate(row.shipment_date_log),
    approvedDate: parseDate(row.approved_date),
    undeliveredDate: parseDate(row.undelivered_date),
    rescheduleDate: null,
    returnedDate: parseDate(row.returned_date),
    updateUser: null,
    storeId: Number(row.store_id ?? 0),
    currencyCode: row.currency?.trim() || undefined,
  };
}

let memoryCache: { items: OrderLineItem[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAllOrderLineItems(force = false): Promise<OrderLineItem[]> {
  const now = Date.now();
  if (!force && memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.items;
  }

  const supabase = getOpsDb();
  const rows: DbOrderRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as DbOrderRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const items = rows
    .map(mapDbRowToOrderLineItem)
    .filter((item): item is OrderLineItem => item != null);

  memoryCache = { items, fetchedAt: now };
  return items;
}

export function clearOrderLineItemsCache() {
  memoryCache = null;
}
