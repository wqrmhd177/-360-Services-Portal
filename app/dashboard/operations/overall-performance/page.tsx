import { redirect } from "next/navigation";
import { SheetAnalyticsFilterBar } from "@/components/operations/SheetAnalyticsFilterBar";
import { OperationsPageHeader } from "@/components/operations/OperationsPageHeader";
import {
  parseOptionalDateParam,
  parseSheetCountryParam,
} from "@/lib/operations/sheetCountries";
import { getPortalSession } from "@/lib/session";

export default async function OverallPerformancePage({
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

  return (
    <div className="space-y-3">
      <OperationsPageHeader
        title="Overall Performance"
        subtitle="Same Date (default All) and Country filters as OP Performance. Status-queue metrics come next."
        showRefresh
      />
      <SheetAnalyticsFilterBar country={country} from={from} to={to} />
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">
        Overall Performance KPIs will be built after OP Performance is wired
        to Raw Data.
      </div>
    </div>
  );
}
