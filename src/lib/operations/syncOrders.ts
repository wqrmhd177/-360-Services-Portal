import { spawn } from "child_process";
import path from "path";
import { getOpsServiceDb, logSync, refreshOrdersSummaries } from "@/lib/operations/opsDb";
import { enrichOrderRows } from "@/lib/orders/enrichment";
import { clearOrderLineItemsCache } from "@/lib/orders/lineItems";
import { METABASE_ORDERS_URL, normalizeOrderRows } from "@/lib/operations/orders";
import { updateSyncJob } from "@/lib/operations/syncJobs";

/** REST fallback batch size (Python uses 5000+ via direct Postgres). */
const BATCH = 5000;
const PARALLEL = 4;

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

function pythonCommand(): { cmd: string; prefixArgs: string[] } {
  if (process.env.PYTHON_PATH) {
    return { cmd: process.env.PYTHON_PATH, prefixArgs: [] };
  }
  if (process.platform === "win32") {
    return { cmd: "py", prefixArgs: ["-3"] };
  }
  return { cmd: "python3", prefixArgs: [] };
}

/** Run fast Python sync (direct Postgres batch upsert). */
export async function runPythonOrdersSync(jobId?: string): Promise<SyncOrdersResult | null> {
  const script = path.join(process.cwd(), "scripts", "sync_orders.py");
  const { cmd, prefixArgs } = pythonCommand();
  const args = [...prefixArgs, script];
  if (jobId) args.push("--job-id", jobId);

  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        resolve(null);
        return;
      }
      resolve({ ok: false, rowCount: 0, error: err.message });
    });

    proc.on("close", (code) => {
      if (code === null) {
        resolve({ ok: false, rowCount: 0, error: "Python sync process terminated" });
        return;
      }

      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] ?? "";

      try {
        const parsed = JSON.parse(lastLine) as SyncOrdersResult & { elapsedSeconds?: number };
        if (parsed.ok) {
          clearOrderLineItemsCache();
          resolve({ ok: true, rowCount: parsed.rowCount ?? 0 });
          return;
        }
        resolve({
          ok: false,
          rowCount: 0,
          error: parsed.error ?? stderr.trim() ?? "Python sync failed",
        });
        return;
      } catch {
        if (code === 0) {
          resolve({ ok: true, rowCount: 0 });
          return;
        }
        resolve({
          ok: false,
          rowCount: 0,
          error: stderr.trim() || stdout.trim() || `Python sync exited with code ${code}`,
        });
      }
    });
  });
}

/** Legacy REST upsert fallback when Python is unavailable (e.g. Vercel without Python). */
async function syncOrdersRestFallback(
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

    const raw = await response.json();
    const rows = normalizeOrderRows(raw);
    const enriched = enrichOrderRows(rows);
    const supabase = getOpsServiceDb();
    const syncedAt = new Date().toISOString();
    const total = enriched.length;

    const slices: ReturnType<typeof mapRowToDb>[] = [];
    function mapRowToDb(r: (typeof enriched)[number]) {
      return {
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
      };
    }

    for (const r of enriched) {
      slices.push(mapRowToDb(r));
    }

    async function upsertSlice(slice: typeof slices) {
      const { error } = await supabase
        .from("ops_orders_items")
        .upsert(slice, { onConflict: "order_id,sku" });
      if (error) throw new Error(error.message);
      return slice.length;
    }

    let processed = 0;
    for (let i = 0; i < slices.length; i += BATCH * PARALLEL) {
      const batchPromises: Promise<number>[] = [];
      for (let p = 0; p < PARALLEL; p++) {
        const start = i + p * BATCH;
        if (start >= total) break;
        batchPromises.push(upsertSlice(slices.slice(start, start + BATCH)));
      }
      const counts = await Promise.all(batchPromises);
      processed += counts.reduce((a, b) => a + b, 0);
      await reportProgress(jobId, Math.min(processed, total), total, onProgress);
    }

    await supabase.from("ops_orders_items").delete().lt("synced_at", syncedAt);
    await logSync("orders", enriched.length, "success");
    clearOrderLineItemsCache();

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

/**
 * Sync orders: prefers Python (direct Postgres batch upsert), falls back to parallel REST.
 * Set SYNC_ORDERS_FORCE_REST=1 to skip Python (Vercel serverless).
 */
export async function syncOrdersFromMetabase(
  options: SyncOrdersOptions = {},
): Promise<SyncOrdersResult> {
  const forceRest = process.env.SYNC_ORDERS_FORCE_REST === "1";

  if (!forceRest) {
    const pythonResult = await runPythonOrdersSync(options.jobId);
    if (pythonResult != null) {
      return pythonResult;
    }
    console.warn(
      "Python sync unavailable — falling back to parallel REST upsert. " +
        "Install Python + pip install -r scripts/requirements-sync.txt and set DATABASE_URL for fast sync.",
    );
  }

  return syncOrdersRestFallback(options);
}
