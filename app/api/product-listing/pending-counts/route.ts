import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import { getPendingPriceRequestCount } from "@/lib/productListing/priceHistoryHelpers";
import { getPendingStatusChangeCount } from "@/lib/productListing/variantStatusChangeHelpers";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createSupabaseServiceClient();
    const [pricePending, statusPending] = await Promise.all([
      getPendingPriceRequestCount(db),
      getPendingStatusChangeCount(db),
    ]);

    return NextResponse.json({
      pricePending,
      statusPending,
      total: pricePending + statusPending,
    });
  } catch (error) {
    console.error("pending-counts:", error);
    return NextResponse.json({ pricePending: 0, statusPending: 0, total: 0 });
  }
}
