import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { hasServiceRoleKey } from "@/lib/operations/syncAll";
import { syncInventoryFromMetabase } from "@/lib/operations/syncInventory";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        hint: "Add the service role key in Vercel environment variables and redeploy.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await syncInventoryFromMetabase();
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Sync failed",
          hint: "Ensure setup_operations_cache.sql has been run and SUPABASE_SERVICE_ROLE_KEY is set.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      rowCount: result.rowCount,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
