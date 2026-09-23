import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { listPickingProductLogs } from "@/lib/operations/pickingAudit";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sku = String(request.nextUrl.searchParams.get("sku") ?? "").trim();
    if (!sku) {
      return NextResponse.json({ error: "sku is required." }, { status: 400 });
    }
    const logs = await listPickingProductLogs(sku);
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not load history";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
