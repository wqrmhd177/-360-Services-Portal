import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated, parsePageParams } from "@/lib/operations/apiAuth";
import { getLastSync } from "@/lib/operations/opsDb";
import { fetchChannelListPage } from "@/lib/operations/syncChannelList";
import {
  matchesChannelSearch,
  normalizeChannelListRows,
  METABASE_CHANNEL_LIST_URL,
} from "@/lib/operations/channelList";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { page, limit, search } = parsePageParams(request);
  const lastSync = await getLastSync("channel_list");

  try {
    const { channels, total } = await fetchChannelListPage(search, page, limit);
    return NextResponse.json({
      channels,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      lastSyncedAt: lastSync?.synced_at ?? null,
      needsSync: !lastSync?.synced_at && !search,
      source: "supabase",
    });
  } catch (dbErr) {
    try {
      const response = await fetch(METABASE_CHANNEL_LIST_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) {
        return NextResponse.json(
          { error: "Unable to fetch channel list. Run setup_operations_cache.sql and sync." },
          { status: 502 }
        );
      }
      const raw = await response.json();
      const all = normalizeChannelListRows(raw).filter((r) => matchesChannelSearch(r, search));
      const total = all.length;
      const offset = (page - 1) * limit;
      const channels = all.slice(offset, offset + limit);
      return NextResponse.json({
        channels,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        lastSyncedAt: lastSync?.synced_at ?? null,
        needsSync: !lastSync?.synced_at && !search,
        source: "metabase_fallback",
        warning: "Loading from Metabase — cache will populate after the first sync.",
      });
    } catch {
      const msg = dbErr instanceof Error ? dbErr.message : "Failed to load channel list";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}
