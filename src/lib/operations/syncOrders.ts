import { METABASE_ORDERS_URL, normalizeOrderRows } from "@/lib/operations/orders";
import { getOpsDb, getOpsServiceDb, logSync } from "@/lib/operations/opsDb";

const BATCH = 500;

export async function syncOrdersFromMetabase(): Promise<{
  ok: boolean;
  rowCount: number;
  error?: string;
}> {
  try {
    const response = await fetch(METABASE_ORDERS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const msg = "Unable to fetch orders from Metabase";
      await logSync("orders", 0, "failed", msg);
      return { ok: false, rowCount: 0, error: msg };
    }

    const raw = await response.json();
    const rows = normalizeOrderRows(raw);
    const supabase = getOpsServiceDb();
    const syncedAt = new Date().toISOString();

    const { error: delErr } = await supabase.from("ops_orders_items").delete().gte("id", 0);
    if (delErr) {
      await logSync("orders", 0, "failed", delErr.message);
      return { ok: false, rowCount: 0, error: delErr.message };
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH).map((r) => ({
        order_id: r.orderId,
        order_number: r.orderNumber,
        domain: r.domain,
        store_id: r.storeId,
        store_url: r.storeUrl,
        country: r.country,
        city: r.city,
        title: r.title,
        sku: r.sku,
        quantity: r.quantity,
        total_payable: r.totalPayable,
        currency: r.currency,
        status: r.status,
        substatus: r.substatus,
        tag: r.tag,
        bifurcation: r.bifurcation,
        delivery_partner: r.deliveryPartner,
        platform: r.platform,
        order_date: r.orderDate?.toISOString() ?? null,
        approved_date: r.approvedDate?.toISOString() ?? null,
        shipment_date: r.shipmentDate?.toISOString() ?? null,
        shipment_date_log: r.shipmentDateLog?.toISOString() ?? null,
        delivered_date: r.deliveredDate?.toISOString() ?? null,
        returned_date: r.returnedDate?.toISOString() ?? null,
        undelivered_date: r.undeliveredDate?.toISOString() ?? null,
        synced_at: syncedAt,
      }));

      const { error } = await supabase.from("ops_orders_items").insert(slice);
      if (error) {
        await logSync("orders", 0, "failed", error.message);
        return { ok: false, rowCount: 0, error: error.message };
      }
    }

    await logSync("orders", rows.length, "success");
    return { ok: true, rowCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    await logSync("orders", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}

export async function fetchOrdersFiltered(params: {
  country?: string;
  bifurcation?: string;
  storeId?: number;
  from?: string;
  to?: string;
}) {
  const supabase = getOpsDb();
  const { data, error } = await supabase.rpc("get_ops_orders_filtered", {
    p_country: params.country ?? null,
    p_bifurcation: params.bifurcation ?? null,
    p_store_id: params.storeId ?? null,
    p_from_date: params.from ?? null,
    p_to_date: params.to ?? null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}
