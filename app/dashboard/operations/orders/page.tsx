import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  defaultOrdersSearchParams,
  OrdersAnalyticsSection,
} from "@/components/operations/OrdersAnalyticsSection";
import { OrdersPageShell } from "@/components/operations/OrdersPageShell";
import { PortalPageLoading } from "@/components/layout/portal-loading";
import { fetchCachedFilterOptionsFromDb } from "@/lib/orders/filteredItems";
import { getLastSync } from "@/lib/operations/opsDb";
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

  const sp = mergeSearchParams(await searchParams);

  const [filterOptions, lastSync] = await Promise.all([
    fetchCachedFilterOptionsFromDb(),
    getLastSync("orders"),
  ]);

  return (
    <OrdersPageShell
      searchParams={sp}
      filterOptions={{
        countries: filterOptions.countries,
        bifurcations: filterOptions.bifurcations,
      }}
      lastSyncedAt={lastSync?.synced_at ?? null}
    >
      <Suspense fallback={<PortalPageLoading label="Loading operations analytics" />}>
        <OrdersAnalyticsSection searchParams={sp} />
      </Suspense>
    </OrdersPageShell>
  );
}
