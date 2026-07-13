import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { fetchFilterOptionsFromDb } from "@/lib/orders/filteredItems";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const opts = await fetchFilterOptionsFromDb();
    return NextResponse.json(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load filter options";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
