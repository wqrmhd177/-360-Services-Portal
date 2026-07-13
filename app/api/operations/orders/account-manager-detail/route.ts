import { NextRequest, NextResponse } from "next/server";
import { getAccountManagerDetailFromDb } from "@/lib/orders/dbAnalytics";
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

  const accountManagerName = request.nextUrl.searchParams.get("accountManagerName")?.trim();
  if (!accountManagerName) {
    return NextResponse.json(
      { error: "Missing accountManagerName parameter" },
      { status: 400 },
    );
  }

  try {
    const paramsObj = searchParamsToObject(request);
    delete paramsObj.am;
    delete paramsObj.accountManagerName;

    const payload = await getAccountManagerDetailFromDb(paramsObj, accountManagerName);
    const { from, to } = serializeDateRange(payload.range);

    return NextResponse.json({
      accountManager: payload.accountManager,
      range: { from, to },
      titles: payload.titles,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load account manager detail";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
