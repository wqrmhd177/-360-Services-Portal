import { NextRequest, NextResponse } from "next/server";
import {
  METABASE_CHANNEL_LIST_URL,
  normalizeChannelListRows,
} from "@/lib/operations/channelList";

const SESSION_COOKIE = "portal_session";

function isAuthenticated(request: NextRequest): boolean {
  const val = request.cookies.get(SESSION_COOKIE)?.value;
  if (!val) return false;
  try {
    const parsed = JSON.parse(val);
    return Boolean(parsed?.email);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(METABASE_CHANNEL_LIST_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch channel list from Metabase" },
        { status: 502 }
      );
    }

    const raw = await response.json();
    const channels = normalizeChannelListRows(raw);

    return NextResponse.json({ channels, count: channels.length });
  } catch (error) {
    console.error("Error fetching channel list:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching channel list" },
      { status: 500 }
    );
  }
}
