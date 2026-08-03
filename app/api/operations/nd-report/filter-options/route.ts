import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getNdFilterOptions } from "@/lib/operations/ndReport";
import { dedupeCountryFilterOptions } from "@/lib/country-normalization";
import { fetchCachedFilterOptionsFromDb } from "@/lib/orders/filteredItems";
import { OPS_FILTER_OPTIONS_TAG } from "@/lib/operations/cache";

const fetchFilterOptions = unstable_cache(
  async () => {
    try {
      const options = await getNdFilterOptions();
      if (options.countries.length > 0 || options.bifurcations.length > 0) {
        return {
          countries: dedupeCountryFilterOptions(options.countries),
          bifurcations: options.bifurcations,
        };
      }
    } catch {
      /* fall through to orders filter options */
    }
    const fallback = await fetchCachedFilterOptionsFromDb();
    return {
      countries: fallback.countries,
      bifurcations: fallback.bifurcations,
    };
  },
  ["nd-report-filter-options"],
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
