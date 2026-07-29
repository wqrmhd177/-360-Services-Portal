import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { invalidateOpsDataCache } from "@/lib/operations/cache";

function isAuthorizedRevalidate(request: NextRequest): boolean {
  if (isPortalAuthenticated(request)) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRevalidate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    invalidateOpsDataCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Revalidation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
