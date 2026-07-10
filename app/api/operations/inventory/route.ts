import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated, parsePageParams } from "@/lib/operations/apiAuth";
import { getLastSync } from "@/lib/operations/opsDb";
import { fetchInventoryPage } from "@/lib/operations/syncInventory";
import {
  filterInventoryRows,
  normalizeInventoryRows,
  METABASE_INVENTORY_URL,
} from "@/lib/operations/inventory";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { page, limit, search } = parsePageParams(request);
  const lastSync = await getLastSync("inventory");

  try {
    const { items, total } = await fetchInventoryPage(search, page, limit);
    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      lastSyncedAt: lastSync?.synced_at ?? null,
      needsSync: !lastSync?.synced_at && !search,
      source: "supabase",
    });
  } catch (dbErr) {
    // Fallback: direct Metabase when cache tables are not set up yet
    try {
      const response = await fetch(METABASE_INVENTORY_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) {
        return NextResponse.json(
          { error: "Unable to fetch inventory. Run setup_operations_cache.sql and sync." },
          { status: 502 }
        );
      }
      const raw = await response.json();
      const all = filterInventoryRows(normalizeInventoryRows(raw), search);
      const total = all.length;
      const offset = (page - 1) * limit;
      const items = all.slice(offset, offset + limit);
      return NextResponse.json({
        items,
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
      const msg = dbErr instanceof Error ? dbErr.message : "Failed to load inventory";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}
