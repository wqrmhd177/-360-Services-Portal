import { redirect } from "next/navigation";
import { SheetAnalyticsFilterBar } from "@/components/operations/SheetAnalyticsFilterBar";
import { OperationsPageHeader } from "@/components/operations/OperationsPageHeader";
import { TicketingDashboard } from "@/components/operations/TicketingDashboard";
import { TicketingSyncBar } from "@/components/operations/TicketingSyncBar";
import { getTicketFactsLastSynced } from "@/lib/operations/opsDb";
import {
  getTicketingAnalytics,
  parseTicketDirectionParam,
} from "@/lib/operations/ticketing";
import { parseOptionalDateParam } from "@/lib/operations/sheetCountries";
import { getPortalSession } from "@/lib/session";

export default async function TicketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const from = parseOptionalDateParam(sp.from) ?? "";
  const to = parseOptionalDateParam(sp.to) ?? "";
  const direction = parseTicketDirectionParam(sp.direction);
  const [data, lastSync] = await Promise.all([
    getTicketingAnalytics(sp),
    getTicketFactsLastSynced(),
  ]);

  return (
    <div className="space-y-3">
      <OperationsPageHeader
        title="Ticketing"
        subtitle="Final Ticket Date (D), Ticket ID (E), Category (I), Sub-category (J), Status (K), Direction (Q). First staff reply is Y (minutes); resolution is AB (hours)."
      >
        <TicketingSyncBar lastSyncedAt={lastSync} />
      </OperationsPageHeader>
      <SheetAnalyticsFilterBar
        country=""
        from={from}
        to={to}
        direction={direction}
        hideCountry
        showDirection
      />
      <TicketingDashboard
        data={data}
        direction={direction}
        from={from}
        to={to}
      />
    </div>
  );
}
