import { NextResponse } from "next/server";
import { getNotifications } from "@/lib/notifications";
import { getPortalSession } from "@/lib/session";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await getNotifications(session.email);
    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Failed to get notifications:", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}
