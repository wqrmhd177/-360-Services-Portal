import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getSkuPerformanceSummary } from "@/lib/operations/skuPerformance";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  try {
    const result = await getSkuPerformanceSummary({
      filters: {
        country: sp.get("country"),
        bifurcation: sp.get("bifurcation"),
        fromDate: sp.get("from"),
        toDate: sp.get("to"),
        search: sp.get("search"),
      },
      page: parseInt(sp.get("page") ?? "1", 10) || 1,
      pageSize: parseInt(sp.get("page_size") ?? "20", 10) || 20,
      sortBy: sp.get("sort_by") ?? "approved_quantity",
      sortDirection: (sp.get("sort_direction") === "asc" ? "asc" : "desc") as
        | "asc"
        | "desc",
    });

    return NextResponse.json({
      ok: true,
      data: result.data,
      filters: {
        country: sp.get("country"),
        bifurcation: sp.get("bifurcation"),
        from: sp.get("from"),
        to: sp.get("to"),
        search: sp.get("search"),
      },
      pagination: {
        page: parseInt(sp.get("page") ?? "1", 10) || 1,
        page_size: parseInt(sp.get("page_size") ?? "20", 10) || 20,
        total_records: result.totalRecords,
        total_pages: result.totalPages,
      },
      data_freshness: {
        mv_refreshed_at: result.mvRefreshedAt,
        inventory_refreshed_at: result.inventoryRefreshedAt,
      },
      inventory_warning: result.inventoryWarning,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load SKU performance";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
