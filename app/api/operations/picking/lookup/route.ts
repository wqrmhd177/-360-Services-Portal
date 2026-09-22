import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { lookupPickingProducts } from "@/lib/operations/picking";
import { withPickingPictureUrl } from "@/lib/operations/pickingUploads";

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { skus?: unknown };
    const skus = Array.isArray(body.skus)
      ? body.skus.map((s) => String(s ?? "").trim()).filter(Boolean)
      : [];
    if (skus.length === 0) {
      return NextResponse.json({ error: "Provide one or more SKUs." }, { status: 400 });
    }
    if (skus.length > 500) {
      return NextResponse.json({ error: "Lookup is limited to 500 SKUs." }, { status: 400 });
    }
    const items = (await lookupPickingProducts(skus)).map((row) =>
      withPickingPictureUrl(row),
    );
    const found = new Set(items.map((row) => row.sku.toLowerCase()));
    const missing = skus.filter((sku) => !found.has(sku.toLowerCase()));
    return NextResponse.json({ items, missing });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
