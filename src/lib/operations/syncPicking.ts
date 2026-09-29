import { getOpsDb, logSync } from "@/lib/operations/opsDb";
import { lookupPickingProducts, upsertPickingProductRows } from "@/lib/operations/picking";
import {
  factsFromMasterProductsCsv,
  factsFromPickingCsv,
  fetchMasterProductsSheetCsv,
  fetchPickingSheetCsv,
  type PickingProductRow,
} from "@/lib/operations/pickingSheet";
import {
  fetchPickingImageFromUrl,
  isPortalPickingImageUrl,
  uploadPickingImageBuffer,
} from "@/lib/operations/pickingUploads";

export type PickingSyncResult = {
  ok: boolean;
  rowCount: number;
  error?: string;
};

export type PickingImageSyncResult = {
  copied: number;
  failed: number;
  remaining: number;
  stored: number;
  errors: string[];
  done: boolean;
  timedOut: boolean;
};

export type PickingImageSyncOptions = {
  maxMs?: number;
  concurrency?: number;
  pageSize?: number;
  skuGte?: string;
  skuLt?: string;
};

type ImageSchema = "pending_flag" | "sheet_url" | "legacy";

type PendingImageRow = {
  sku: string;
  image_url: string | null;
  sheet_image_url?: string | null;
  image_source_url?: string | null;
  source?: string | null;
};

async function fetchRawCsv(): Promise<string> {
  return fetchPickingSheetCsv();
}

export async function syncPickingFromSheet(): Promise<PickingSyncResult> {
  try {
    const csv = await fetchRawCsv();
    const rows = factsFromPickingCsv(csv);
    await upsertPickingProductRows(rows);
    await logSync("picking", rows.length, "success");
    return { ok: true, rowCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Picking sync failed";
    await logSync("picking", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}

function missingColumn(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  );
}

async function detectImageSchema(): Promise<ImageSchema> {
  const supabase = getOpsDb();
  const pending = await supabase
    .from("ops_picking_products")
    .select("image_pending")
    .limit(1);
  if (!pending.error) return "pending_flag";
  const sheet = await supabase
    .from("ops_picking_products")
    .select("sheet_image_url,image_source_url")
    .limit(1);
  if (!sheet.error) return "sheet_url";
  return "legacy";
}

function isPendingRow(row: PendingImageRow, schema: ImageSchema): boolean {
  const sheetUrl = String(row.sheet_image_url || row.image_url || "");
  if (!/^https?:\/\//i.test(sheetUrl)) return false;
  if (isPortalPickingImageUrl(sheetUrl)) return false;
  if (schema === "legacy") {
    return !isPortalPickingImageUrl(row.image_url);
  }
  if (row.image_source_url === sheetUrl) return false;
  if (row.source === "manual" && isPortalPickingImageUrl(row.image_url)) {
    return false;
  }
  return true;
}

function pendingImageQuery(
  schema: ImageSchema,
  columns: string,
  options?: { count?: "exact"; head?: boolean },
  range?: { skuAfter?: string; skuGte?: string; skuLt?: string },
) {
  let q = getOpsDb().from("ops_picking_products").select(columns, options);
  if (schema === "pending_flag") {
    q = q.eq("image_pending", true);
  } else if (schema === "sheet_url") {
    q = q
      .not("sheet_image_url", "is", null)
      .like("sheet_image_url", "http%")
      .or(
        "image_source_url.is.null,image_url.not.ilike.%/storage/v1/object/public/product_images/%",
      );
  } else {
    q = q
      .not("image_url", "is", null)
      .like("image_url", "http%")
      .not("image_url", "like", "%/storage/v1/object/public/product_images/%");
  }
  if (range?.skuAfter) q = q.gt("sku", range.skuAfter);
  else if (range?.skuGte) q = q.gte("sku", range.skuGte);
  if (range?.skuLt) q = q.lt("sku", range.skuLt);
  return q;
}

function pendingSelect(schema: ImageSchema): string {
  return schema === "legacy"
    ? "sku,image_url"
    : "sku,image_url,sheet_image_url,image_source_url,source";
}

async function countStoredImages(): Promise<number> {
  const { count } = await getOpsDb()
    .from("ops_picking_products")
    .select("sku", { count: "exact", head: true })
    .like("image_url", "%/storage/v1/object/public/product_images/%");
  return count ?? 0;
}

function fallbackSchema(schema: ImageSchema): ImageSchema | null {
  if (schema === "pending_flag") return "sheet_url";
  if (schema === "sheet_url") return "legacy";
  return null;
}

async function countPendingImages(schema: ImageSchema): Promise<number> {
  const { count, error } = await pendingImageQuery(schema, "sku", {
    count: "exact",
    head: true,
  });
  if (error && missingColumn(error.message)) {
    const next = fallbackSchema(schema);
    if (!next) throw new Error(error.message);
    return countPendingImages(next);
  }
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getPickingImageSyncStats(): Promise<{
  pending: number;
  stored: number;
}> {
  try {
    const schema = await detectImageSchema();
    const [pending, stored] = await Promise.all([
      countPendingImages(schema),
      countStoredImages(),
    ]);
    return { pending, stored };
  } catch {
    return { pending: 0, stored: 0 };
  }
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await fn(item);
    }
  }
  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export async function syncPickingImagesUntil(
  options: PickingImageSyncOptions = {},
  schemaArg?: ImageSchema,
): Promise<PickingImageSyncResult> {
  const supabase = getOpsDb();
  const schema = schemaArg ?? (await detectImageSchema());
  const maxMs = options.maxMs ?? 240_000;
  const concurrency = Math.min(48, Math.max(4, options.concurrency ?? 32));
  const pageSize = Math.min(500, Math.max(20, options.pageSize ?? 400));
  const started = Date.now();
  let copied = 0;
  let failed = 0;
  let skuAfter = "";
  let done = false;
  let timedOut = false;
  const errors: string[] = [];

  const deadline = maxMs > 0 ? started + maxMs : Number.POSITIVE_INFINITY;

  while (Date.now() < deadline - 8_000) {
    const { data, error } = await pendingImageQuery(
      schema,
      pendingSelect(schema),
      undefined,
      {
        skuAfter: skuAfter || undefined,
        skuGte: skuAfter ? undefined : options.skuGte,
        skuLt: options.skuLt,
      },
    )
      .order("sku", { ascending: true })
      .limit(pageSize);

    if (error) {
      const next = missingColumn(error.message) ? fallbackSchema(schema) : null;
      if (next) return syncPickingImagesUntil(options, next);
      throw new Error(error.message);
    }

    const rows = ((data ?? []) as unknown as PendingImageRow[]).filter((row) =>
      Boolean(row.sku && isPendingRow(row, schema)),
    );
    if (rows.length === 0) {
      done = true;
      break;
    }

    skuAfter = String(rows[rows.length - 1].sku);

    await runPool(rows, concurrency, async (row) => {
      if (Date.now() >= deadline) {
        timedOut = true;
        return;
      }
      const sourceUrl = String(row.sheet_image_url || row.image_url || "");
      try {
        const { buffer, contentType } = await fetchPickingImageFromUrl(sourceUrl);
        const publicUrl = await uploadPickingImageBuffer(
          buffer,
          String(row.sku),
          contentType,
        );
        const patch: Record<string, string> = {
          image_url: publicUrl,
          updated_at: new Date().toISOString(),
        };
        if (schema !== "legacy") {
          patch.image_source_url = sourceUrl;
          if (!row.sheet_image_url) patch.sheet_image_url = sourceUrl;
        }
        const { error: upErr } = await supabase
          .from("ops_picking_products")
          .update(patch)
          .eq("sku", row.sku);
        if (upErr) {
          if (missingColumn(upErr.message)) {
            const { error: legacyErr } = await supabase
              .from("ops_picking_products")
              .update({
                image_url: publicUrl,
                updated_at: patch.updated_at,
              })
              .eq("sku", row.sku);
            if (legacyErr) throw new Error(legacyErr.message);
          } else {
            throw new Error(upErr.message);
          }
        }
        copied += 1;
      } catch (err) {
        failed += 1;
        if (errors.length < 8) {
          const msg = err instanceof Error ? err.message : "download failed";
          errors.push(`${row.sku}: ${msg}`);
        }
      }
    });

    if (Date.now() >= deadline - 8_000) {
      timedOut = true;
      break;
    }
  }

  if (!done && Date.now() >= deadline - 8_000) timedOut = true;

  let remaining = 0;
  let stored = 0;
  try {
    [remaining, stored] = await Promise.all([
      countPendingImages(schema),
      countStoredImages(),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not count remaining pictures";
    if (errors.length < 8) errors.push(msg);
  }
  return { copied, failed, remaining, stored, errors, done, timedOut };
}

export async function syncPickingImagesBatch(
  limit = 400,
  schemaArg?: ImageSchema,
): Promise<PickingImageSyncResult> {
  return syncPickingImagesUntil(
    { maxMs: 240_000, pageSize: Math.min(500, Math.max(20, limit)), concurrency: 32 },
    schemaArg,
  );
}

// ─── Master Products smart sync ───────────────────────────────────────────────

export type MasterSyncResult = {
  ok: boolean;
  added: number;
  updated: number;
  skipped: number;
  imagesCopied: number;
  imagesFailed: number;
  error?: string;
};

// ─── shared smart-merge helper ────────────────────────────────────────────────

async function smartMergeRows(
  sheetRows: PickingProductRow[],
  createdBy: string | null,
): Promise<{ added: number; updated: number; skipped: number }> {
  if (sheetRows.length === 0) return { added: 0, updated: 0, skipped: 0 };

  const allSkus = sheetRows.map((r) => r.sku);
  const existingRows = await lookupPickingProducts(allSkus);
  const existingMap = new Map(existingRows.map((r) => [r.sku.toLowerCase(), r]));

  const toInsert: PickingProductRow[] = [];
  const toUpdate: PickingProductRow[] = [];
  let skipped = 0;

  for (const row of sheetRows) {
    const existing = existingMap.get(row.sku.toLowerCase());
    const sheetUrl = row.sheet_image_url || row.image_url;
    const hasPortalImage = Boolean(
      existing?.image_url?.includes("/storage/v1/object/public/product_images/"),
    );

    if (!existing) {
      toInsert.push(row);
      continue;
    }

    if (hasPortalImage) {
      skipped++;
      continue;
    }

    // Pending or missing picture: sync Drive URL from sheet (no duplicate SKU rows).
    const needsImageSync =
      Boolean(sheetUrl) &&
      (!existing.image_url || existing.image_url !== sheetUrl);

    if (needsImageSync) {
      toUpdate.push({
        ...row,
        image_url: sheetUrl,
        sheet_image_url: sheetUrl,
        product_name: row.product_name?.trim() || existing.product_name,
      });
      continue;
    }

    skipped++;
  }

  const rowsToWrite = [...toInsert, ...toUpdate];
  if (rowsToWrite.length > 0) {
    await upsertPickingProductRows(rowsToWrite, createdBy);
  }
  return { added: toInsert.length, updated: toUpdate.length, skipped };
}

/**
 * Sync Products — Master Products Google Sheet only (smart merge, no duplicates).
 * 1. Fetch Master sheet CSV → insert new SKUs, update pending/changed images only.
 * 2. Copy pending Drive URLs → Supabase storage.
 */
export async function syncMasterPickingSheet(
  createdBy?: string | null,
): Promise<MasterSyncResult> {
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    const masterCsv = await fetchMasterProductsSheetCsv();
    const masterRows = factsFromMasterProductsCsv(masterCsv);
    if (masterRows.length === 0) {
      return {
        ok: true,
        added: 0,
        updated: 0,
        skipped: 0,
        imagesCopied: 0,
        imagesFailed: 0,
      };
    }

    const masterMerge = await smartMergeRows(masterRows, createdBy ?? null);
    totalAdded = masterMerge.added;
    totalUpdated = masterMerge.updated;
    totalSkipped = masterMerge.skipped;
    await logSync("picking", masterMerge.added + masterMerge.updated, "success");

    // Copy pending Drive URLs → Supabase
    let imagesCopied = 0;
    let imagesFailed = 0;
    try {
      const imageResult = await syncPickingImagesUntil({
        maxMs: 50_000,
        concurrency: 8,
        pageSize: 100,
      });
      imagesCopied = imageResult.copied;
      imagesFailed = imageResult.failed;
    } catch {
      // Image sync is best-effort — don't fail the whole operation.
    }

    return {
      ok: true,
      added: totalAdded,
      updated: totalUpdated,
      skipped: totalSkipped,
      imagesCopied,
      imagesFailed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    try { await logSync("picking", 0, "failed", msg); } catch { /* ignore */ }
    return {
      ok: false,
      added: 0,
      updated: 0,
      skipped: 0,
      imagesCopied: 0,
      imagesFailed: 0,
      error: msg,
    };
  }
}
