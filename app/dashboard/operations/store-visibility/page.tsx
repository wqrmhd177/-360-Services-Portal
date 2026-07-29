import { Suspense } from "react";
import { redirect } from "next/navigation";
import OrdersFilterBar from "@/components/operations/OrdersFilterBar";
import { StoreVisibilitySection } from "@/components/operations/StoreVisibilitySection";
import { defaultOrdersSearchParams } from "@/components/operations/OrdersAnalyticsSection";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import { fetchCachedFilterOptionsFromDb } from "@/lib/orders/filteredItems";
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

export default async function StoreVisibilityPage({
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

  const country = typeof sp.country === "string" ? sp.country : "";
  const bifurcation = typeof sp.bifurcation === "string" ? sp.bifurcation : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const storeId = typeof sp.store_id === "string" ? sp.store_id : "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Operations — Store Visibility
        </h1>
      </div>

      <OrdersFilterBar
        options={{
          countries: filterOptions.countries,
          bifurcations: filterOptions.bifurcations,
          storeIds: filterOptions.storeIds,
          storeOptions: filterOptions.storeOptions,
        }}
        country={country}
        bifurcation={bifurcation}
        from={from}
        to={to}
        storeId={storeId}
        showStoreFilter
      />

      <Suspense fallback={<PortalPageLoading label="Loading store visibility" />}>
        <StoreVisibilitySection searchParams={sp} />
      </Suspense>
    </div>
  );
}
