import { NextRequest, NextResponse } from "next/server";
import { isPortalAdmin } from "@/lib/accessControl";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import {
  getInventoryFulfilmentRouteOptions,
  getInventoryFulfilmentRoutes,
  upsertInventoryFulfilmentRoute,
} from "@/lib/operations/ndReport";
import { getPortalSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const skusParam = sp.get("skus");
  const skus = skusParam
    ? skusParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const [routes, options] = await Promise.all([
      getInventoryFulfilmentRoutes(skus),
      getInventoryFulfilmentRouteOptions(),
    ]);
    return NextResponse.json({ ok: true, routes, options });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load fulfilment routes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
  const sku = String(body.sku ?? "").trim();
  const fulfilmentRoute = String(body.fulfilment_route ?? "").trim();

  if (!sku || !fulfilmentRoute) {
    return NextResponse.json(
      { error: "sku and fulfilment_route are required" },
      { status: 400 },
    );
  }

  try {
    const result = await upsertInventoryFulfilmentRoute({
      sku,
      fulfilmentRoute,
      updatedBy: session.email,
    });
    return NextResponse.json({ ok: true, route: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save fulfilment route";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
