import { DeliveryPartnerChartCard } from "@/components/orders/delivery-partner-chart-card";
import { OperationsSlaKpis } from "@/components/orders/operations-sla-kpis";
import { OperationsStatusKpis } from "@/components/orders/operations-status-kpis";
import { RevenueLossTable } from "@/components/orders/revenue-loss-table";
import { getOperationsAnalyticsCached } from "@/lib/operations/cache";
import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";
import { parseDateRange, serializeDateRange } from "@/lib/orders/params";

export async function OrdersAnalyticsSection({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const range = parseDateRange(searchParams);
  if (!range.fromDate || !range.toDate) {
    return null;
  }

  const data = await getOperationsAnalyticsCached(searchParams);

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
  const rangeLabel = `${from} – ${to}`;

  return (
    <section className="space-y-6">
      <OperationsSlaKpis sla={data.fulfillmentSLA} rangeLabel={rangeLabel} />
      <OperationsStatusKpis
        counts={data.operationsStatusCounts}
        rangeLabel={rangeLabel}
      />
      <DeliveryPartnerChartCard data={data.deliveryPartnerByCountry} />
      <RevenueLossTable title="Revenue Loss" rows={data.revenueLossBreakdown} />
    </section>
  );
}

export function defaultOrdersSearchParams(): Record<string, string> {
  const { from, to } = defaultDateRange();
  return {
    from: toInputValue(from),
    to: toInputValue(to),
  };
}
