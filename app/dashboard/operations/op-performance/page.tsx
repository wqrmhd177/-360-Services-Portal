import { redirect } from "next/navigation";
import { SheetAnalyticsFilterBar } from "@/components/operations/SheetAnalyticsFilterBar";
import { OpPerformanceDashboard } from "@/components/operations/OpPerformanceDashboard";
import { OpPerformanceSyncBar } from "@/components/operations/OpPerformanceSyncBar";
import { OperationsPageHeader } from "@/components/operations/OperationsPageHeader";
import { getOpPerformanceAnalytics } from "@/lib/operations/opPerformance";
import { getOpFactsLastSynced } from "@/lib/operations/opsDb";
import {
  parseOptionalDateParam,
  parseSheetCountryParam,
} from "@/lib/operations/sheetCountries";
import { getPortalSession } from "@/lib/session";

export default async function OpPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const country = parseSheetCountryParam(sp.country);
  const from = parseOptionalDateParam(sp.from) ?? "";
  const to = parseOptionalDateParam(sp.to) ?? "";
  const [data, lastSync] = await Promise.all([
    getOpPerformanceAnalytics(sp),
    getOpFactsLastSynced(),
  ]);

  return (
    <div className="space-y-3">
      <OperationsPageHeader
        title="OP Performance"
        subtitle="OP Raw Data: Order Date (F), Unique Order ID (H), Country (M), CS Status (E), Tags (G), Status (AF). Defaults to All."
      >
        <OpPerformanceSyncBar lastSyncedAt={lastSync} />
      </OperationsPageHeader>

      <SheetAnalyticsFilterBar country={country} from={from} to={to} />
      <OpPerformanceDashboard
        data={data}
        country={country}
        from={from}
        to={to}
      />
    </div>
  );
}
