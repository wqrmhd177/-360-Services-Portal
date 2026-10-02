import { Suspense } from "react";
import { redirect } from "next/navigation";
import { defaultOrdersSearchParams } from "@/components/operations/OrdersAnalyticsSection";
import {
  OrdersChartsSection,
  OrdersSlaSection,
  OrdersStatusSection,
} from "@/components/operations/OrdersKpiChartsSections";
import { OrdersPageShell } from "@/components/operations/OrdersPageShell";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import { fetchCachedFilterOptionsFromDb, scopeFilterOptionsForSession } from "@/lib/orders/filteredItems";
import { getLastSync } from "@/lib/operations/opsDb";
import { enforceSearchParamsCountry, getCountryScopeFromSession } from "@/lib/portalCountryScope";
import { getPortalSession } from "@/lib/session";

function mergeSearchParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const defaults = defaultOrdersSearchParams();
  return {
    ...defaults,
    ...raw,
    from: typeof raw.from === "string" && raw.from ? raw.from : defaults.from,
    to: typeof raw.to === "string" && raw.to ? raw.to : defaults.to,
  };
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const sp = enforceSearchParamsCountry(
    mergeSearchParams(await searchParams),
    getCountryScopeFromSession(session),
  );

  const [filterOptionsRaw, lastSync] = await Promise.all([
    fetchCachedFilterOptionsFromDb(),
    getLastSync("orders"),
  ]);
  const filterOptions = scopeFilterOptionsForSession(
    filterOptionsRaw,
    getCountryScopeFromSession(session),
  );

  return (
    <OrdersPageShell
      searchParams={sp}
      filterOptions={{
        countries: filterOptions.countries,
        bifurcations: filterOptions.bifurcations,
      }}
      lastSyncedAt={lastSync?.synced_at ?? null}
    >
      <section className="space-y-4">
        <Suspense fallback={<PortalPageLoading label="Loading status KPIs" />}>
          <OrdersStatusSection searchParams={sp} />
        </Suspense>
        <Suspense fallback={<PortalPageLoading label="Loading SLA metrics" />}>
          <OrdersSlaSection searchParams={sp} />
        </Suspense>
        <Suspense fallback={<PortalPageLoading label="Loading charts" />}>
          <OrdersChartsSection searchParams={sp} />
        </Suspense>
      </section>
    </OrdersPageShell>
  );
}
