import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { requireZambeelAccess } from "@/lib/movements/access";
import { procurementActionOnMovement } from "@/lib/movements/db";
import type { ProcurementAction } from "@/lib/movements/status";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json();
    const action = body.action as ProcurementAction;
    if (!["accept", "complete", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const remarks = typeof body.remarks === "string" ? body.remarks : undefined;
    const movement = await procurementActionOnMovement(session!, id, action, remarks);
    return NextResponse.json(movement);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update movement";
    const status = msg.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
