import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { fetchOrdersFiltered } from "@/lib/operations/syncOrders";
import { normalizeDbOrderRows } from "@/lib/operations/orders";
import {
  computeKPIs,
  computeTitleBreakdown,
  computeDeliveryPartnerBreakdownByCountry,
} from "@/lib/operations/orderAnalytics";
import { getLastSync } from "@/lib/operations/opsDb";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const country = sp.get("country") || undefined;
  const bifurcation = sp.get("bifurcation") || undefined;
  const storeIdParam = sp.get("store_id");
  const storeId = storeIdParam ? Number(storeIdParam) : undefined;
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;

  const lastSync = await getLastSync("orders");

  try {
    const raw = await fetchOrdersFiltered({ country, bifurcation, storeId, from, to });
    const rows = normalizeDbOrderRows(raw);

    const kpis = computeKPIs(rows);
    const titleBreakdown = computeTitleBreakdown(rows, 20);
    const deliveryByCountry = computeDeliveryPartnerBreakdownByCountry(rows);

    return NextResponse.json({
      ok: true,
      totalRows: rows.length,
      lastSyncedAt: lastSync?.synced_at ?? null,
      kpis,
      titleBreakdown,
      deliveryByCountry,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analytics failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
