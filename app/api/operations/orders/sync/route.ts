import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getOpsServiceDb, logSync } from "@/lib/operations/opsDb";

const ORDERS_METABASE_URL = process.env.METABASE_OPERATIONS_ORDERS_URL ?? "";

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ORDERS_METABASE_URL) {
    return NextResponse.json(
      {
        error: "Orders Metabase URL is not configured.",
        hint: "Add METABASE_OPERATIONS_ORDERS_URL to your environment variables.",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(ORDERS_METABASE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      await logSync("orders", 0, "failed", "Metabase fetch failed");
      return NextResponse.json({ error: "Unable to fetch orders from Metabase" }, { status: 502 });
    }

    const raw = await response.json();
    const rows = Array.isArray(raw) ? raw : [];
    const supabase = getOpsServiceDb();
    const syncedAt = new Date().toISOString();

    await supabase.from("ops_orders_items").delete().gte("id", 0);

    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH).map((payload) => ({
        payload,
        synced_at: syncedAt,
      }));
      const { error } = await supabase.from("ops_orders_items").insert(slice);
      if (error) {
        await logSync("orders", 0, "failed", error.message);
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
    }

    await logSync("orders", rows.length, "success");
    return NextResponse.json({
      ok: true,
      rowCount: rows.length,
      syncedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    await logSync("orders", 0, "failed", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
