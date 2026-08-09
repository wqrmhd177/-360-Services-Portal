import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { requireZambeelAccess } from "@/lib/movements/access";
import { rejectMovementByApprover } from "@/lib/movements/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const remarks = typeof body.remarks === "string" ? body.remarks : undefined;
    const movement = await rejectMovementByApprover(session!, id, remarks);
    return NextResponse.json(movement);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to reject movement";
    const status = msg.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
