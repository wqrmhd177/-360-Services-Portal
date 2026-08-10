import {
  METABASE_INVENTORY_URL,
  normalizeInventoryRows,
  type InventoryRow,
} from "@/lib/operations/inventory";
import { clearInventorySkuCache } from "@/lib/metabaseInventory";
import { clearInventoryLookupCache } from "@/lib/inventoryLookup";
import { getOpsDb, getOpsServiceDb, logSync, refreshInventorySummary } from "@/lib/operations/opsDb";
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH = 500;

/** Which optional ops_inventory_items columns exist in Supabase (movement_quantity added later). */
type InventoryInsertMode = "full" | "po_only" | "base";

function isMissingColumnError(message: string, column: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes(column.toLowerCase()) && lower.includes("schema cache");
}

function buildInventoryInsertRow(
  row: InventoryRow,
  syncedAt: string,
  mode: InventoryInsertMode,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: row.user_id === "—" ? null : row.user_id,
    username: row.username === "—" ? null : row.username,
    product_name: row.product_name,
    sku: row.sku,
    available_quantity: row.available_quantity,
    country: row.country,
    category: row.category,
    synced_at: syncedAt,
  };

  if (mode === "full" || mode === "po_only") {
    payload.po_quantity = row.po_quantity;
  }
  if (mode === "full") {
    payload.movement_quantity = row.movement_quantity;
  }

  return payload;
}

async function detectInventoryInsertMode(
  supabase: SupabaseClient,
  sample: InventoryRow,
  syncedAt: string,
): Promise<InventoryInsertMode> {
  const modes: InventoryInsertMode[] = ["full", "po_only", "base"];

  for (const mode of modes) {
    const { data, error } = await supabase
      .from("ops_inventory_items")
      .insert([buildInventoryInsertRow(sample, syncedAt, mode)])
      .select("id")
      .maybeSingle();

    if (!error) {
      if (data?.id != null) {
        await supabase.from("ops_inventory_items").delete().eq("id", data.id);
      }
      return mode;
    }

    if (mode === "full" && isMissingColumnError(error.message, "movement_quantity")) {
      continue;
    }
    if (
      (mode === "full" || mode === "po_only") &&
      isMissingColumnError(error.message, "po_quantity")
    ) {
      continue;
    }

    throw new Error(error.message);
  }

  return "base";
}

async function insertInventoryBatch(
  supabase: SupabaseClient,
  rows: InventoryRow[],
  syncedAt: string,
  mode: InventoryInsertMode,
) {
  const slice = rows.map((row) => buildInventoryInsertRow(row, syncedAt, mode));
  const { error } = await supabase.from("ops_inventory_items").insert(slice);
  if (error) throw new Error(error.message);
}

export async function syncInventoryFromMetabase(): Promise<{
  ok: boolean;
  rowCount: number;
  error?: string;
}> {
  try {
    const response = await fetch(METABASE_INVENTORY_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const msg = "Unable to fetch inventory from Metabase";
      await logSync("inventory", 0, "failed", msg);
      return { ok: false, rowCount: 0, error: msg };
    }

    const raw = await response.json();
    const rows = normalizeInventoryRows(raw);
    const supabase = getOpsServiceDb();
    const syncedAt = new Date().toISOString();

    const insertMode =
      rows.length > 0
        ? await detectInventoryInsertMode(supabase, rows[0], syncedAt)
        : "base";

    const { error: delErr } = await supabase
      .from("ops_inventory_items")
      .delete()
      .gte("id", 0);

    if (delErr) {
      await logSync("inventory", 0, "failed", delErr.message);
      return { ok: false, rowCount: 0, error: delErr.message };
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      await insertInventoryBatch(supabase, rows.slice(i, i + BATCH), syncedAt, insertMode);
    }

    await refreshInventorySummary();
    clearInventorySkuCache();
    clearInventoryLookupCache();
    await logSync("inventory", rows.length, "success");
    return { ok: true, rowCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    await logSync("inventory", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}

export async function fetchInventoryPage(
  search: string,
  page: number,
  limit: number
): Promise<{ items: InventoryRow[]; total: number }> {
  const supabase = getOpsDb();
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc("search_ops_inventory", {
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

  const items: InventoryRow[] = rows.map((r) => ({
    user_id: r.user_id ? String(r.user_id) : "—",
    username: r.username ? String(r.username) : "—",
    product_name: String(r.product_name ?? ""),
    sku: String(r.sku ?? ""),
    available_quantity: Number(r.available_quantity ?? 0),
    po_quantity: Number(r.po_quantity ?? 0),
    movement_quantity: Number(r.movement_quantity ?? 0),
    country: String(r.country ?? ""),
    category: String(r.category ?? ""),
  }));

  return { items, total };
}
