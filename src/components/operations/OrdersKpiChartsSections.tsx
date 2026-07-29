import { OperationsSlaKpis } from "@/components/orders/operations-sla-kpis";
import { OperationsStatusKpis } from "@/components/orders/operations-status-kpis";
import { DeliveryPartnerChartCard } from "@/components/orders/delivery-partner-chart-card";
import { RevenueLossTable } from "@/components/orders/revenue-loss-table";
import {
  getOperationsChartsCached,
  getOperationsSlaCached,
  getOperationsStatusKpisCached,
} from "@/lib/operations/cache";
import { parseDateRange, serializeDateRange } from "@/lib/orders/params";

export async function OrdersStatusSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseDateRange(searchParams);
  if (!range.fromDate || !range.toDate) return null;

  const data = await getOperationsStatusKpisCached(searchParams);
  if (data.filteredCount === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="text-sm font-medium text-amber-900">
          No orders data for this date range. Click Sync Data to load from Metabase.
        </p>
      </div>
    );
  }

  const { from, to } = serializeDateRange(data.range);
  return (
    <OperationsStatusKpis
      counts={data.operationsStatusCounts}
      rangeLabel={`${from} – ${to}`}
    />
  );
}

export async function OrdersSlaSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseDateRange(searchParams);
  if (!range.fromDate || !range.toDate) return null;

  const data = await getOperationsSlaCached(searchParams);
  if (data.filteredCount === 0) return null;

  const { from, to } = serializeDateRange(data.range);
  return (
    <OperationsSlaKpis
      sla={data.fulfillmentSLA}
      rangeLabel={`${from} – ${to}`}
    />
  );
}

export async function OrdersChartsSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseDateRange(searchParams);
  if (!range.fromDate || !range.toDate) return null;

  const data = await getOperationsChartsCached(searchParams);
  if (data.filteredCount === 0) return null;

  return (
    <>
      <DeliveryPartnerChartCard data={data.deliveryPartnerByCountry} />
      <RevenueLossTable title="Revenue Loss" rows={data.revenueLossBreakdown} />
    </>
  );
}
