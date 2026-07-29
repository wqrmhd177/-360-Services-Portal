import { Suspense } from "react";
import { redirect } from "next/navigation";
import SkuPerformanceFilterBar from "@/components/operations/SkuPerformanceFilterBar";
import { SkuPerformanceSection } from "@/components/operations/SkuPerformanceSection";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";
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

export default async function SkuPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const sp = mergeSearchParams(await searchParams);
  const filterOptions = await fetchCachedFilterOptionsFromDb();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">SKU Performance</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Order metrics by SKU with seller breakdown. All Operations dates use PST.
        </p>
      </div>

      <SkuPerformanceFilterBar
        options={{
          countries: filterOptions.countries,
          bifurcations: filterOptions.bifurcations,
        }}
      />

      <Suspense fallback={<PortalPageLoading label="Loading SKU data…" />}>
        <SkuPerformanceSection searchParams={sp} />
      </Suspense>
    </div>
  );
}
