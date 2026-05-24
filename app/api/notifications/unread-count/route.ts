import { NextResponse } from "next/server";
import { getUnreadCount } from "@/lib/notifications";
import { getPortalSession } from "@/lib/session";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await getUnreadCount(session.email);
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to get unread notification count:", error);
    return NextResponse.json({ error: "Failed to get count" }, { status: 500 });
  }
}
