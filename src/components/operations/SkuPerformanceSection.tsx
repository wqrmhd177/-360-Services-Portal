import { SkuPerformanceTable } from "@/components/operations/SkuPerformanceTable";
import { SkuPerformancePaginationClient } from "@/components/operations/SkuPerformancePaginationClient";
import { getSkuPerformanceSummaryCached } from "@/lib/operations/cache";
import { formatPstTimestamp } from "@/lib/operations/skuPerformance";

export async function SkuPerformanceSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const from = typeof searchParams.from === "string" ? searchParams.from : "";
  const to = typeof searchParams.to === "string" ? searchParams.to : "";
  if (!from || !to) return null;

  const country = typeof searchParams.country === "string" ? searchParams.country : null;
  const bifurcation =
    typeof searchParams.bifurcation === "string" ? searchParams.bifurcation : null;
  const search = typeof searchParams.search === "string" ? searchParams.search : null;
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);

  const filterQuery = new URLSearchParams();
  if (country) filterQuery.set("country", country);
  if (bifurcation) filterQuery.set("bifurcation", bifurcation);
  if (from) filterQuery.set("from", from);
  if (to) filterQuery.set("to", to);
  if (search) filterQuery.set("search", search);

  const result = await getSkuPerformanceSummaryCached({
    filters: { country, bifurcation, fromDate: from, toDate: to, search },
    page,
    pageSize: 20,
    sortBy: "approved_quantity",
    sortDirection: "desc",
  });

  return (
    <>
      <div className="space-y-1 text-xs text-[var(--muted)]">
        {result.mvRefreshedAt ? (
          <p>Orders data refreshed: {formatPstTimestamp(result.mvRefreshedAt)}</p>
        ) : null}
        {result.inventoryRefreshedAt ? (
          <p>Inventory synced: {formatPstTimestamp(result.inventoryRefreshedAt)}</p>
        ) : null}
        {result.inventoryWarning ? (
          <p className="text-amber-600">{result.inventoryWarning}</p>
        ) : null}
      </div>

      <SkuPerformanceTable rows={result.data} filterQuery={filterQuery.toString()} />
      <SkuPerformancePaginationClient
        currentPage={page}
        totalPages={result.totalPages}
        totalRecords={result.totalRecords}
        filterQuery={filterQuery.toString()}
      />
    </>
  );
}
