import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getPortalSession } from "@/lib/session";
import { syncMasterPickingSheet } from "@/lib/operations/syncPicking";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getPortalSession();
  const result = await syncMasterPickingSheet(session?.email ?? null);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Sync failed" }, { status: 500 });
  }

  return NextResponse.json(result);
}
