import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import {
  createAnnouncement,
  getAnnouncements,
} from "@/lib/announcements";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const announcements = await getAnnouncements({ limit: 50 });
    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Failed to get announcements:", error);
    return NextResponse.json(
      { error: "Failed to load announcements" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only Procurement (or admin) can create announcements
  const isProcurement = session.role === "procurement";
  const isAdmin = !!session.isAdmin;

  if (!isProcurement && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content, title, isActive, roleScope } = (body as Record<string, unknown>) ?? {};

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "Announcement content is required" },
      { status: 400 }
    );
  }

  try {
    const announcement = await createAnnouncement({
      body: content.trim(),
      title: typeof title === "string" ? title.trim() : undefined,
      roleScope: typeof roleScope === "string" ? roleScope : undefined,
      createdByEmail: session.email,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error("Failed to create announcement:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to create announcement";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

