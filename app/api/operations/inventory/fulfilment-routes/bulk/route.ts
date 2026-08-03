import { NextRequest, NextResponse } from "next/server";
import { isPortalAdmin } from "@/lib/accessControl";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { bulkUpsertInventoryFulfilmentRoutes } from "@/lib/operations/ndReport";
import { getPortalSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPortalAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const routes = Array.isArray(body.routes) ? body.routes : [];

  if (routes.length === 0) {
    return NextResponse.json({ error: "routes array is required" }, { status: 400 });
  }

  try {
    const result = await bulkUpsertInventoryFulfilmentRoutes({
      routes: routes.map((r: Record<string, unknown>) => ({
        sku: String(r.sku ?? "").trim(),
        fulfilment_route: String(r.fulfilment_route ?? r.route ?? "").trim(),
      })),
      updatedBy: session.email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bulk upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
