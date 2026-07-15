import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getLastSync } from "@/lib/operations/opsDb";
import { getOperationsAnalytics } from "@/lib/orders/analyticsData";
import { serializeDateRange } from "@/lib/orders/params";

export const maxDuration = 60;

function searchParamsToObject(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const result: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(sp.keys())) {
    const values = sp.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = searchParamsToObject(request);
    const data = await getOperationsAnalytics(params);
    const lastSync = await getLastSync("orders");
    const { from, to } = serializeDateRange(data.range);

    // #region agent log
    fetch("http://127.0.0.1:7764/ingest/d1ead4db-e7ce-43dc-9e13-a703fdb1f6ba", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "75f7fa",
      },
      body: JSON.stringify({
        sessionId: "75f7fa",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "analytics/route.ts:GET",
        message: "analytics request params",
        data: {
          params,
          rangeFrom: from,
          rangeTo: to,
          lastSyncedAt: lastSync?.synced_at ?? null,
          totalOrdersKpi: data.operationsStatusCounts.totalOrders,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return NextResponse.json({
      ok: true,
      lastSyncedAt: lastSync?.synced_at ?? null,
      rangeLabel: `${from} – ${to}`,
      fulfillmentSLA: data.fulfillmentSLA,
      operationsStatusCounts: data.operationsStatusCounts,
      revenueLossBreakdown: data.revenueLossBreakdown,
      deliveryPartnerByCountry: data.deliveryPartnerByCountry,
      filterOptions: data.filterOptions,
      filteredCount: data.filteredCount,
      allCount: data.allCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analytics failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
