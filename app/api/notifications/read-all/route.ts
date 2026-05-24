import { NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/notifications";
import { getPortalSession } from "@/lib/session";

export async function POST() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await markAllNotificationsRead(session.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark all notifications read:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
