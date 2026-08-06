import NdReportFilterBar from "@/components/operations/NdReportFilterBar";
import { NdReportPaginationClient } from "@/components/operations/NdReportPaginationClient";
import { NdReportTable } from "@/components/operations/NdReportTable";
import { KpiCard, KPI_COMPACT_GRID_CLASS } from "@/components/orders/kpi-card";
import { getNdReportSummaryCached } from "@/lib/operations/cache";
import { formatNumber } from "@/lib/utils";

export async function NdReportSection({
  searchParams,
  filterOptions,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  filterOptions: { countries: string[]; bifurcations: string[] };
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
    <div className="space-y-2">
      <div className={KPI_COMPACT_GRID_CLASS}>
        <KpiCard compact title="ND SKUs" value={formatNumber(result.totals.nd_skus)} variant="items" />
        <KpiCard
          compact
          title="ND Orders"
          value={formatNumber(result.totals.nd_orders)}
          variant="orders"
        />
        <KpiCard
          compact
          title="ND Quantity"
          value={formatNumber(result.totals.nd_quantity)}
          variant="units"
        />
        <KpiCard
          compact
          title="Affected Stores"
          value={formatNumber(result.totals.affected_stores)}
          variant="delivered"
        />
      </div>

      <NdReportFilterBar options={filterOptions} />

      <NdReportTable rows={result.data} filterQuery={filterQuery.toString()} />

      <NdReportPaginationClient
        currentPage={page}
        totalPages={result.totalPages}
        totalRecords={result.totalRecords}
        filterQuery={filterQuery.toString()}
      />
    </div>
  );
}
