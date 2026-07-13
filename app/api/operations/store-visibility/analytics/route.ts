import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getLastSync } from "@/lib/operations/opsDb";
import { getStoreVisibilityAnalytics } from "@/lib/orders/analyticsData";
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
    const data = await getStoreVisibilityAnalytics(params);
    const lastSync = await getLastSync("orders");
    const { from, to } = serializeDateRange(data.range);

    return NextResponse.json({
      ok: true,
      lastSyncedAt: lastSync?.synced_at ?? null,
      rangeLabel: `${from} – ${to}`,
      ...data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analytics failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
