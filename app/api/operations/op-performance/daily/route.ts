import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getOpPerformanceDaily } from "@/lib/operations/opPerformance";

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
    const data = await getOpPerformanceDaily(searchParamsToObject(request));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Day-wise OP stats failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
