import { NextRequest, NextResponse } from "next/server";
import { syncAllOperations, hasServiceRoleKey } from "@/lib/operations/syncAll";

export const maxDuration = 300;

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    const result = await syncAllOperations();
    const ok = result.inventory.ok && result.channelList.ok && result.orders.ok;
    return NextResponse.json({
      ok,
      syncedAt: new Date().toISOString(),
      inventory: result.inventory,
      channelList: result.channelList,
      orders: result.orders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cron sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
