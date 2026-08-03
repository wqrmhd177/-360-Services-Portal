import { NdReportPaginationClient } from "@/components/operations/NdReportPaginationClient";
import { NdReportTable } from "@/components/operations/NdReportTable";
import { getNdReportSummaryCached } from "@/lib/operations/cache";
import { formatPstTimestamp } from "@/lib/operations/ndReport";

export async function NdReportSection({
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

  const result = await getNdReportSummaryCached({
    filters: { country, bifurcation, fromDate: from, toDate: to, search },
    page,
    pageSize: 20,
    sortBy: "nd_quantity",
    sortDir: "desc",
  });

  return (
    <>
      <div className="space-y-1 text-xs text-[var(--muted)]">
        {result.mvRefreshedAt ? (
          <p>ND data refreshed: {formatPstTimestamp(result.mvRefreshedAt)}</p>
        ) : null}
        {result.inventoryRefreshedAt ? (
          <p>Inventory synced: {formatPstTimestamp(result.inventoryRefreshedAt)}</p>
        ) : null}
      </div>

      <NdReportTable
        rows={result.data}
        totals={result.totals}
        filterQuery={filterQuery.toString()}
      />

      <NdReportPaginationClient
        currentPage={page}
        totalPages={result.totalPages}
        totalRecords={result.totalRecords}
        filterQuery={filterQuery.toString()}
      />
    </>
  );
}
