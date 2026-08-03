import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getInventoryFulfilmentRouteLogs } from "@/lib/operations/ndReport";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sku = request.nextUrl.searchParams.get("sku");
  if (!sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  try {
    const logs = await getInventoryFulfilmentRouteLogs(sku);
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load route logs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
