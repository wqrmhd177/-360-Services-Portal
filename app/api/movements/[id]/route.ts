import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { requireZambeelAccess } from "@/lib/movements/access";
import {
  canViewMovement,
  getMovementById,
  updateMovementByCreator,
} from "@/lib/movements/db";
import { getMovementLogs } from "@/lib/movements/inventory";
import type { UpdateMovementPayload } from "@/types/movements";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  const { id } = await params;

  try {
    const movement = await getMovementById(id);
    if (!movement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canViewMovement(session!, movement)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const logs = await getMovementLogs(id);
    return NextResponse.json({ movement, logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load movement";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getPortalSession();
  const denied = requireZambeelAccess(session);
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = (await request.json()) as UpdateMovementPayload;
    const movement = await updateMovementByCreator(session!, id, body);
    return NextResponse.json(movement);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update movement";
    const status = msg.includes("Forbidden") ? 403 : msg.includes("Cannot") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
