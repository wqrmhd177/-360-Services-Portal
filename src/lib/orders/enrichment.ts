import type { OrderLineItem } from "@/lib/types/order";
import { applyRevenueImputation } from "@/lib/analytics/revenue-imputation";
import { convertToUsd } from "@/lib/order-currency";
import type { OrderRow } from "@/lib/operations/orders";

export function accountManagerKey(row: OrderRow): string {
  return (
    row.domain?.trim() ||
    row.storeUrl?.trim() ||
    (row.storeId ? `Store ${row.storeId}` : "Unknown")
  );
}

export function enrichOrderRows(rows: OrderRow[]): Array<OrderRow & {
  resolvedPayable: number;
  payableEstimated: boolean;
  usdRevenue: number;
  accountManagerKey: string;
  orderDateDay: string | null;
}> {
  const lineItems: OrderLineItem[] = rows
    .filter((r) => r.orderDate != null)
    .map((r) => ({
      metabaseId: r.orderId,
      orderNumber: r.orderNumber,
      country: r.country,
      fullName: r.fullName,
      phone: "",
      shipping: "",
      city: r.city,
      title: r.title,
      sku: r.sku,
      quantity: r.quantity,
      totalPayable: r.totalPayable,
      status: r.status,
      substatus: r.substatus,
      tag: r.tag,
      opRemarks: "",
      bifurcation: r.bifurcation,
      platform: r.platform,
      accountManager: accountManagerKey(r),
      deliveryPartner: r.deliveryPartner,
      undeliveredTag: null,
      courierTrackingId: "",
      orderDate: r.orderDate!,
      deliveredDate: r.deliveredDate,
      shipmentDate: r.shipmentDate,
      shipmentDateLog: r.shipmentDateLog,
      approvedDate: r.approvedDate,
      undeliveredDate: r.undeliveredDate,
      rescheduleDate: null,
      returnedDate: r.returnedDate,
      updateUser: null,
      storeId: r.storeId,
      currencyCode: r.currency?.trim() || undefined,
    }));

  const imputed = applyRevenueImputation(lineItems);
  const imputedByKey = new Map(
    imputed.map((item) => [`${item.metabaseId}:${item.sku}`, item]),
  );

  return rows.map((row) => {
    const key = `${row.orderId}:${row.sku}`;
    const item = imputedByKey.get(key);
    const resolvedPayable = item?.resolvedPayable ?? (row.totalPayable > 0 ? row.totalPayable : 0);
    const payableEstimated = item?.payableEstimated ?? false;
    const usdRevenue = convertToUsd(
      resolvedPayable,
      row.country,
      row.sku,
      row.currency?.trim() || undefined,
    );
    const orderDateDay = row.orderDate
      ? row.orderDate.toISOString().slice(0, 10)
      : null;

    return {
      ...row,
      resolvedPayable,
      payableEstimated,
      usdRevenue,
      accountManagerKey: accountManagerKey(row),
      orderDateDay,
    };
  });
}
