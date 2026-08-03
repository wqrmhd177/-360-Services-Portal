import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { upsertNdStoreRemark } from "@/lib/operations/ndReport";
import { getPortalSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const country = String(body.country ?? "").trim();
  const bifurcation = String(body.bifurcation ?? "").trim();
  const sku = String(body.sku ?? "").trim();
  const storeId = Number(body.store_id);
  const opsRemarks = body.ops_remarks == null ? "" : String(body.ops_remarks);
  const growthFeedback =
    body.growth_feedback == null ? "" : String(body.growth_feedback);
  const status = String(body.status ?? "Open").trim() as "Open" | "Pending" | "Closed";

  if (!country || !sku || !storeId) {
    return NextResponse.json(
      { error: "country, sku, and store_id are required" },
      { status: 400 },
    );
  }

  if (!["Open", "Pending", "Closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const result = await upsertNdStoreRemark({
      country,
      bifurcation,
      sku,
      storeId,
      opsRemarks: opsRemarks.trim() || null,
      growthFeedback: growthFeedback.trim() || null,
      status,
      updatedBy: session.email,
    });
    return NextResponse.json({ ok: true, remark: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save remark";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
