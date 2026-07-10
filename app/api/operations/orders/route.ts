import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated, parsePageParams } from "@/lib/operations/apiAuth";
import { getLastSync } from "@/lib/operations/opsDb";

const ORDERS_METABASE_URL = process.env.METABASE_OPERATIONS_ORDERS_URL ?? "";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { page, limit } = parsePageParams(request);
  const lastSync = await getLastSync("orders");

  return NextResponse.json({
    orders: [],
    total: 0,
    page,
    limit,
    totalPages: 1,
    lastSyncedAt: lastSync?.synced_at ?? null,
    configured: Boolean(ORDERS_METABASE_URL),
    message: ORDERS_METABASE_URL
      ? "Orders cache empty — click Sync to load from Metabase."
      : "Set METABASE_OPERATIONS_ORDERS_URL in Vercel env to enable Orders sync.",
  });
}
