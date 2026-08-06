import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getNdSkuDetails } from "@/lib/operations/ndReport";

export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sku } = await params;
  const sp = request.nextUrl.searchParams;
  const country = sp.get("country");
  const bifurcation = sp.get("bifurcation");

  if (!country) {
    return NextResponse.json({ error: "country is required" }, { status: 400 });
  }

  try {
    const result = await getNdSkuDetails({
      sku: decodeURIComponent(sku),
      country,
      bifurcation: bifurcation ?? "",
      fromDate: sp.get("from"),
      toDate: sp.get("to"),
    });

    return NextResponse.json({
      ok: true,
      sku: decodeURIComponent(sku),
      rows: result.rows,
      stuck_orders: result.stuckOrders,
      movement_suggestions: result.movementSuggestions,
      sku_totals: result.skuTotals,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load SKU details";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
