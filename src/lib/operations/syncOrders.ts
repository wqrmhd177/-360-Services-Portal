import { METABASE_ORDERS_URL, normalizeOrderRows } from "@/lib/operations/orders";
import { getOpsServiceDb, logSync, refreshOrdersSummaries } from "@/lib/operations/opsDb";
import { enrichOrderRows } from "@/lib/orders/enrichment";
import { clearOrderLineItemsCache } from "@/lib/orders/lineItems";
import { updateSyncJob } from "@/lib/operations/syncJobs";

const BATCH = 1000;

export type SyncOrdersResult = {
  ok: boolean;
  rowCount: number;
  error?: string;
};

export type SyncOrdersOptions = {
  jobId?: string;
  onProgress?: (processed: number, total: number) => void;
};

async function reportProgress(
  jobId: string | undefined,
  processed: number,
  total: number,
  onProgress?: SyncOrdersOptions["onProgress"],
) {
  onProgress?.(processed, total);
  if (!jobId) return;
  await updateSyncJob(jobId, {
    status: "running",
    row_count: processed,
    error_message: `Processing ${processed.toLocaleString()} / ${total.toLocaleString()} rows`,
  });
}

export async function syncOrdersFromMetabase(
  options: SyncOrdersOptions = {},
): Promise<SyncOrdersResult> {
  const { jobId, onProgress } = options;

  try {
    if (jobId) {
      await updateSyncJob(jobId, {
        status: "running",
        error_message: "Fetching data from Metabase…",
      });
    }

    const response = await fetch(METABASE_ORDERS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const msg = "Unable to fetch orders from Metabase";
      await logSync("orders", 0, "failed", msg);
      return { ok: false, rowCount: 0, error: msg };
    }

    if (jobId) {
      await updateSyncJob(jobId, {
        error_message: "Parsing and enriching order rows…",
      });
    }

    const raw = await response.json();
    const rows = normalizeOrderRows(raw);
    const enriched = enrichOrderRows(rows);
    const supabase = getOpsServiceDb();
    const syncedAt = new Date().toISOString();
    const total = enriched.length;

    for (let i = 0; i < enriched.length; i += BATCH) {
      const slice = enriched.slice(i, i + BATCH).map((r) => ({
        order_id: r.orderId,
        order_number: r.orderNumber,
        domain: r.domain,
        store_id: r.storeId,
        store_url: r.storeUrl,
        country: r.country,
        city: r.city,
        full_name: r.fullName,
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
        resolved_payable: r.resolvedPayable,
        payable_estimated: r.payableEstimated,
        usd_revenue: r.usdRevenue,
        account_manager_key: r.accountManagerKey,
        order_date_day: r.orderDateDay,
        synced_at: syncedAt,
      }));

      const { error } = await supabase
        .from("ops_orders_items")
        .upsert(slice, { onConflict: "order_id,sku" });

      if (error) {
        await logSync("orders", 0, "failed", error.message);
        return { ok: false, rowCount: 0, error: error.message };
      }

      const processed = Math.min(i + BATCH, total);
      await reportProgress(jobId, processed, total, onProgress);
    }

    if (jobId) {
      await updateSyncJob(jobId, {
        error_message: "Removing stale rows…",
      });
    }

    await supabase.from("ops_orders_items").delete().lt("synced_at", syncedAt);

    await logSync("orders", enriched.length, "success");
    clearOrderLineItemsCache();

    if (jobId) {
      await updateSyncJob(jobId, {
        error_message: "Refreshing summary views…",
      });
    }

    // MV refresh is best-effort — don't fail the sync if it times out
    try {
      await refreshOrdersSummaries();
    } catch (refreshErr) {
      console.warn(
        "Orders MV refresh failed (sync data is still saved):",
        refreshErr instanceof Error ? refreshErr.message : refreshErr,
      );
    }

    return { ok: true, rowCount: enriched.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    await logSync("orders", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}
