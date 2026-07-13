import { NextRequest, NextResponse } from "next/server";
import { getOperationsStatusDetailFromDb } from "@/lib/orders/dbAnalytics";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
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

  const groupId = request.nextUrl.searchParams.get("group")?.trim();
  if (!groupId) {
    return NextResponse.json({ error: "Missing group parameter" }, { status: 400 });
  }

  try {
    const paramsObj = searchParamsToObject(request);
    delete paramsObj.group;

    const payload = await getOperationsStatusDetailFromDb(paramsObj, groupId);
    const { from, to } = serializeDateRange(payload.range);

    return NextResponse.json({
      group: payload.group,
      range: { from, to },
      detail: payload.detail,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load status details";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
