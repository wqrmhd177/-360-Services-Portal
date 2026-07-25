import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getSkuPerformanceSellers } from "@/lib/operations/skuPerformance";

export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: { sku: string } },
) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const sku = decodeURIComponent(params.sku);

  try {
    const result = await getSkuPerformanceSellers({
      sku,
      filters: {
        country: sp.get("country"),
        bifurcation: sp.get("bifurcation"),
        fromDate: sp.get("from"),
        toDate: sp.get("to"),
      },
      page: parseInt(sp.get("page") ?? "1", 10) || 1,
      pageSize: parseInt(sp.get("page_size") ?? "50", 10) || 50,
    });

    return NextResponse.json({
      ok: true,
      sku,
      data: result.data,
      pagination: {
        page: parseInt(sp.get("page") ?? "1", 10) || 1,
        page_size: parseInt(sp.get("page_size") ?? "50", 10) || 50,
        total_records: result.totalRecords,
        total_pages: result.totalPages,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load seller details";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
