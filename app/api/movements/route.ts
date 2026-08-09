import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { requireZambeelAccess } from "@/lib/movements/access";
import { createMovement, listMovementsForSession } from "@/lib/movements/db";
import type { CreateMovementPayload, MovementHead, MovementShippingMode } from "@/types/movements";
import { isPhase2MovementHead } from "@/lib/movements/status";

const VALID_HEADS: MovementHead[] = ["partner", "gold_to_gold", "360_seller_inventory", "360_zambeel_inventory"];
const VALID_SHIPPING: MovementShippingMode[] = ["road", "air", "sea"];

export async function GET(request: NextRequest) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") ?? "all";
  const createdBy = sp.get("createdBy") ?? undefined;

  try {
    const rows = await listMovementsForSession(session!, {
      status: status === "all" ? undefined : status,
      createdBy,
    });
    return NextResponse.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load movements";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  try {
    const body = (await request.json()) as CreateMovementPayload;

    if (!VALID_HEADS.includes(body.movement_head)) {
      return NextResponse.json({ error: "Invalid movement head" }, { status: 400 });
    }
    if (isPhase2MovementHead(body.movement_head)) {
      return NextResponse.json({ error: "360 Movements are coming in the next phase" }, { status: 400 });
    }
    if (!VALID_SHIPPING.includes(body.shipping_mode)) {
      return NextResponse.json({ error: "Invalid shipping mode" }, { status: 400 });
    }
    if (!body.from_sku?.trim() || !body.to_sku?.trim()) {
      return NextResponse.json({ error: "From and To SKU are required" }, { status: 400 });
    }
    if (!body.from_country?.trim() || !body.to_country?.trim()) {
      return NextResponse.json({ error: "From and To country are required" }, { status: 400 });
    }
    if (!body.quantity || body.quantity <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 });
    }

    const movement = await createMovement(session!, body);
    return NextResponse.json(movement);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create movement";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
