import { OperationsStatusKpis } from "@/components/orders/operations-status-kpis";
import { StoreVisibilityTablesSection } from "@/components/orders/store-visibility-tables-section";
import { getStoreVisibilityAnalyticsCached } from "@/lib/operations/cache";
import { parseDateRange } from "@/lib/orders/params";

export async function StoreVisibilitySection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseDateRange(searchParams);
  if (!range.fromDate || !range.toDate) {
    return null;
  }

  const data = await getStoreVisibilityAnalyticsCached(searchParams);
  const storeId =
    typeof searchParams.store_id === "string" ? searchParams.store_id : "";

  if (data.filteredCount === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-900">
        No data matches the current filters. Sync orders data from the Orders page first.
      </div>
    );
  }

  return (
    <>
      <OperationsStatusKpis
        counts={data.operationsStatusCounts}
        rangeLabel={data.rangeLabel}
      />
      <StoreVisibilityTablesSection
        tables={data.storeTables}
        storeId={storeId || undefined}
      />
    </>
  );
}
