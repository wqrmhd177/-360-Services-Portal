import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { searchInventoryMatches } from "@/lib/inventoryLookup";
import type { InventorySku } from "@/lib/metabaseInventory";

function toInventorySku(match: {
  sku: string;
  quantity: number;
  warehouse_name: string;
  category?: string;
}): InventorySku {
  return {
    sku: match.sku,
    country: match.warehouse_name,
    quantity: match.quantity,
    sku_type: match.category ?? "",
  };
}

export async function GET(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "procurement" && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 3) {
    return NextResponse.json([]);
  }

  try {
    const result = await searchInventoryMatches(q, { limit: 20 });
    return NextResponse.json(result.matches.map(toInventorySku));
  } catch (error) {
    console.error("SKU search error:", error);
    return NextResponse.json({ error: "Failed to search inventory" }, { status: 500 });
  }
}
