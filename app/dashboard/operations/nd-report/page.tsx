import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NdReportSection } from "@/components/operations/NdReportSection";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";
import { getNdFilterOptions } from "@/lib/operations/ndReport";
import { dedupeCountryFilterOptions } from "@/lib/country-normalization";
import { fetchCachedFilterOptionsFromDb } from "@/lib/orders/filteredItems";
import { getPortalSession } from "@/lib/session";

function mergeSearchParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const { from, to } = defaultDateRange();
  const defaults = {
    from: toInputValue(from),
    to: toInputValue(to),
  };
  return {
    ...defaults,
    ...raw,
    from: typeof raw.from === "string" && raw.from ? raw.from : defaults.from,
    to: typeof raw.to === "string" && raw.to ? raw.to : defaults.to,
  };
}

async function loadFilterOptions() {
  try {
    const options = await getNdFilterOptions();
    if (options.countries.length > 0 || options.bifurcations.length > 0) {
      return {
        countries: dedupeCountryFilterOptions(options.countries),
        bifurcations: options.bifurcations,
      };
    }
  } catch {
    /* fall through */
  }
  return fetchCachedFilterOptionsFromDb();
}

export default async function OperationsNdReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const sp = mergeSearchParams(await searchParams);
  const filterOptions = await loadFilterOptions();

  return (
    <Suspense fallback={<PortalPageLoading label="Loading ND report…" />}>
      <NdReportSection searchParams={sp} filterOptions={filterOptions} />
    </Suspense>
  );
}
