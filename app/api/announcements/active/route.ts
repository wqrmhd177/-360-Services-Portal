import { NextResponse } from "next/server";
import { getActiveAnnouncementForDashboard } from "@/lib/announcements";

export async function GET() {
  try {
    const announcement = await getActiveAnnouncementForDashboard();
    return NextResponse.json(announcement);
  } catch (error) {
    console.error("Failed to get active announcement:", error);
    return NextResponse.json(
      { error: "Failed to load active announcement" },
      { status: 500 }
    );
  }
}

