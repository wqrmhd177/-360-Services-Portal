import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { hasServiceRoleKey } from "@/lib/operations/syncAll";
import { syncPickingFromSheet } from "@/lib/operations/syncPicking";

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
      { status: 503 },
    );
  }

  try {
    const result = await syncPickingFromSheet();
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Picking sync failed",
          hint: "Run setup_ops_picking.sql, share the Product Images sheet, then Sync Data again.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      rowCount: result.rowCount,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Picking sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
