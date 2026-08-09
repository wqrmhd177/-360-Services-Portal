import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { requireZambeelAccess } from "@/lib/movements/access";
import { lookupMovementInventory } from "@/lib/movements/inventory";

export async function GET(request: NextRequest) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const sku = sp.get("sku")?.trim() ?? "";
  const country = sp.get("country")?.trim() ?? "";

  if (!sku || !country) {
    return NextResponse.json({ error: "sku and country are required" }, { status: 400 });
  }

  try {
    const result = await lookupMovementInventory(sku, country);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Inventory lookup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
