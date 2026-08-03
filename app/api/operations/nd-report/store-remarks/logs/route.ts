import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getNdRemarkLogs } from "@/lib/operations/ndReport";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const country = sp.get("country");
  const bifurcation = sp.get("bifurcation") ?? "";
  const sku = sp.get("sku");
  const storeId = Number(sp.get("store_id"));

  if (!country || !sku || !storeId) {
    return NextResponse.json(
      { error: "country, sku, and store_id are required" },
      { status: 400 },
    );
  }

  try {
    const logs = await getNdRemarkLogs({
      country,
      bifurcation,
      sku,
      storeId,
    });
    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load remark logs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
