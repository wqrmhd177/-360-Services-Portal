import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { searchSkus } from "@/lib/metabaseInventory";

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
    const results = await searchSkus(q);
    return NextResponse.json(results);
  } catch (error) {
    console.error("SKU search error:", error);
    return NextResponse.json({ error: "Failed to search inventory" }, { status: 500 });
  }
}
