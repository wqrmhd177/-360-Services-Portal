import {
  METABASE_INVENTORY_URL,
  normalizeInventoryRows,
  type InventoryRow,
} from "@/lib/operations/inventory";
import { getOpsDb, getOpsServiceDb, logSync, refreshInventorySummary } from "@/lib/operations/opsDb";

const BATCH = 500;

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

    const { error: delErr } = await supabase
      .from("ops_inventory_items")
      .delete()
      .gte("id", 0);

    if (delErr) {
      await logSync("inventory", 0, "failed", delErr.message);
      return { ok: false, rowCount: 0, error: delErr.message };
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH).map((r) => ({
        user_id: r.user_id === "—" ? null : r.user_id,
        username: r.username === "—" ? null : r.username,
        product_name: r.product_name,
        sku: r.sku,
        available_quantity: r.available_quantity,
        country: r.country,
        category: r.category,
        synced_at: syncedAt,
      }));

      const { error } = await supabase.from("ops_inventory_items").insert(slice);
      if (error) {
        await logSync("inventory", 0, "failed", error.message);
        return { ok: false, rowCount: 0, error: error.message };
      }
    }

    await refreshInventorySummary();
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
    country: String(r.country ?? ""),
    category: String(r.category ?? ""),
  }));

  return { items, total };
}
