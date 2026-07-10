import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { fetchOrdersFiltered } from "@/lib/operations/syncOrders";
import { normalizeDbOrderRows } from "@/lib/operations/orders";
import {
  computeFulfillmentSLA,
  computeOperationsStatusCounts,
  computeDeliveryPartnerBreakdownByCountry,
  computeRevenueLossBreakdown,
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
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;

  const lastSync = await getLastSync("orders");

  try {
    const raw = await fetchOrdersFiltered({ country, bifurcation, from, to });
    const rows = normalizeDbOrderRows(raw);

    const sla = computeFulfillmentSLA(rows);
    const statusCounts = computeOperationsStatusCounts(rows);
    const deliveryPartner = computeDeliveryPartnerBreakdownByCountry(rows);
    const revenueLoss = computeRevenueLossBreakdown(rows);

    return NextResponse.json({
      ok: true,
      totalRows: rows.length,
      lastSyncedAt: lastSync?.synced_at ?? null,
      sla,
      statusCounts,
      deliveryPartner,
      revenueLoss,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analytics failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
