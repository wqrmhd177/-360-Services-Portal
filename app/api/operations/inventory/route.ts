import { NextRequest, NextResponse } from "next/server";
import {
  METABASE_INVENTORY_URL,
  normalizeInventoryRows,
} from "@/lib/operations/inventory";

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
    const response = await fetch(METABASE_INVENTORY_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch inventory from Metabase" },
        { status: 502 }
      );
    }

    const raw = await response.json();
    const items = normalizeInventoryRows(raw);

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("Error fetching operations inventory:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching inventory" },
      { status: 500 }
    );
  }
}
