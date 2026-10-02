import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import {
  fetchCachedFilterOptionsFromDb,
  scopeFilterOptionsForSession,
} from "@/lib/orders/filteredItems";
import { marketScopeForCurrentRequest } from "@/lib/orders/marketScopeServer";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const opts = scopeFilterOptionsForSession(
      await fetchCachedFilterOptionsFromDb(),
      marketScopeForCurrentRequest(),
    );
    return NextResponse.json(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load filter options";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
