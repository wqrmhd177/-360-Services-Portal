import {
  METABASE_CHANNEL_LIST_URL,
  normalizeChannelListRows,
  type ChannelListRow,
} from "@/lib/operations/channelList";
import { getOpsDb, getOpsServiceDb, logSync } from "@/lib/operations/opsDb";

const BATCH = 500;

export async function syncChannelListFromMetabase(): Promise<{
  ok: boolean;
  rowCount: number;
  error?: string;
}> {
  try {
    const response = await fetch(METABASE_CHANNEL_LIST_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const msg = "Unable to fetch channel list from Metabase";
      await logSync("channel_list", 0, "failed", msg);
      return { ok: false, rowCount: 0, error: msg };
    }

    const raw = await response.json();
    const rows = normalizeChannelListRows(raw);
    const supabase = getOpsServiceDb();
    const syncedAt = new Date().toISOString();

    const { error: delErr } = await supabase
      .from("ops_channel_list_items")
      .delete()
      .gte("id", 0);

    if (delErr) {
      await logSync("channel_list", 0, "failed", delErr.message);
      return { ok: false, rowCount: 0, error: delErr.message };
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH).map((r) => ({
        store_id: r.store_id,
        user_id: r.user_id,
        store_name: r.store_name,
        store_url: r.store_url,
        platform: r.platform,
        bifurcation: r.bifurcation,
        confirmation_setting: r.confirmation_setting,
        synced_at: syncedAt,
      }));

      const { error } = await supabase.from("ops_channel_list_items").insert(slice);
      if (error) {
        await logSync("channel_list", 0, "failed", error.message);
        return { ok: false, rowCount: 0, error: error.message };
      }
    }

    await logSync("channel_list", rows.length, "success");
    return { ok: true, rowCount: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    await logSync("channel_list", 0, "failed", msg);
    return { ok: false, rowCount: 0, error: msg };
  }
}

export async function fetchChannelListPage(
  search: string,
  page: number,
  limit: number
): Promise<{ channels: ChannelListRow[]; total: number }> {
  const supabase = getOpsDb();
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc("search_ops_channel_list", {
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

  const channels: ChannelListRow[] = rows.map((r) => ({
    store_id: Number(r.store_id ?? 0),
    user_id: Number(r.user_id ?? 0),
    store_name: String(r.store_name ?? ""),
    store_url: String(r.store_url ?? ""),
    platform: String(r.platform ?? ""),
    bifurcation: String(r.bifurcation ?? ""),
    confirmation_setting: String(r.confirmation_setting ?? ""),
  }));

  return { channels, total };
}
