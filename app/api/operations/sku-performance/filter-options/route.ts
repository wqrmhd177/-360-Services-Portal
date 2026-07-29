import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getOpsDb } from "@/lib/operations/opsDb";
import { OPS_FILTER_OPTIONS_TAG } from "@/lib/operations/cache";

const fetchFilterOptions = unstable_cache(
  async () => {
    const supabase = getOpsDb();
    const { data, error } = await supabase.rpc("get_ops_orders_filter_options_v2");
    if (error) throw new Error(error.message);
    const payload = (data ?? {}) as { countries?: string[]; bifurcations?: string[] };
    return {
      countries: payload.countries ?? [],
      bifurcations: payload.bifurcations ?? [],
    };
  },
  ["sku-performance-filter-options"],
  { revalidate: 3600, tags: [OPS_FILTER_OPTIONS_TAG] },
);

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const options = await fetchFilterOptions();
    return NextResponse.json(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load filter options";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
