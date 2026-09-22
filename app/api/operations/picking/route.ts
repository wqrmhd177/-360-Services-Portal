import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated, parsePageParams } from "@/lib/operations/apiAuth";
import {
  getPickingLastSynced,
  listPickingProducts,
} from "@/lib/operations/picking";
import { withPickingPictureUrl } from "@/lib/operations/pickingUploads";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { page, limit, search } = parsePageParams(request, 25);

  try {
    const [{ items, total }, lastSyncedAt] = await Promise.all([
      listPickingProducts(search, page, limit),
      getPickingLastSynced(),
    ]);
    return NextResponse.json({
      items: items.map((row) => withPickingPictureUrl(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
      lastSyncedAt,
      needsSync: total === 0 && !search,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load picking products";
    if (msg === "MISSING_TABLE") {
      return NextResponse.json(
        {
          error: "Picking catalog is not set up yet.",
          hint: "Run setup_ops_picking.sql in Supabase, then Sync Data.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
