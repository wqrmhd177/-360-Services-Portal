import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications";
import { getPortalSession } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await markNotificationRead(params.id, session.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
