import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getNdReportSummaryCached } from "@/lib/operations/cache";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  try {
    const result = await getNdReportSummaryCached({
      filters: {
        country: sp.get("country"),
        bifurcation: sp.get("bifurcation"),
        fromDate: sp.get("from"),
        toDate: sp.get("to"),
        search: sp.get("search"),
      },
      page: parseInt(sp.get("page") ?? "1", 10) || 1,
      pageSize: parseInt(sp.get("page_size") ?? "20", 10) || 20,
      sortBy: sp.get("sort_by") ?? "nd_quantity",
      sortDir: (sp.get("sort_dir") === "asc" ? "asc" : "desc") as "asc" | "desc",
    });

    return NextResponse.json({
      ok: true,
      totals: result.totals,
      data: result.data,
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load ND report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
