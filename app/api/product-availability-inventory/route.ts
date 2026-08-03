import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { searchInventoryMatches } from "@/lib/inventoryLookup";

export async function GET(request: NextRequest) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawSku = request.nextUrl.searchParams.get("sku") || "";
    if (!rawSku.trim()) {
      return NextResponse.json(
        { error: "sku query parameter is required" },
        { status: 400 }
      );
    }

    const includeZeroQty =
      request.nextUrl.searchParams.get("include_zero_qty") === "true";

    const result = await searchInventoryMatches(rawSku, {
      positiveQuantityOnly: !includeZeroQty,
      limit: 500,
    });

    return NextResponse.json({
      normalizedSku: result.normalizedSku,
      matchedPrefix: result.matchedPrefix,
      matches: result.matches,
      source: result.source,
    });
  } catch (error) {
    console.error("Error in product availability inventory lookup route:", error);
    return NextResponse.json(
      { error: "Unable to fetch inventory feed" },
      { status: 502 }
    );
  }
}
