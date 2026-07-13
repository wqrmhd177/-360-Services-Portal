"use client";

import { useMemo, useState } from "react";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { ChartCardShell } from "@/components/charts/chart-card-shell";
import type {
  DeliveryPartnerByCountryData,
  DeliveryPartnerRow,
} from "@/lib/analytics/orders";
import { cn, formatNumber } from "@/lib/utils";

function formatPartnerDataLabel(row: DeliveryPartnerRow) {
  const pct = Math.round(row.deliveryRatio * 100);
  return `${formatNumber(row.orders)} – ${pct}% Delivery`;
}

export function DeliveryPartnerChartCard({
  data,
}: {
  data: DeliveryPartnerByCountryData;
}) {
  const [selectedCountry, setSelectedCountry] = useState("All");

  const chartRows = useMemo(() => {
    const rows = data.byCountry[selectedCountry] ?? [];
    return rows.map((row) => ({
      ...row,
      chartLabel: formatPartnerDataLabel(row),
    }));
  }, [data.byCountry, selectedCountry]);

  const orderCount = data.orderCountByCountry[selectedCountry] ?? 0;

  return (
    <ChartCardShell title="By delivery partner" variant="bar">
      <div className="mb-4 flex flex-wrap gap-2">
        {data.countries.map((country) => {
          const active = selectedCountry === country;
          const count = data.orderCountByCountry[country] ?? 0;
          return (
            <button
              key={country}
              type="button"
              onClick={() => setSelectedCountry(country)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                  : "border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--table-header)]",
              )}
            >
              {country}{" "}
              <span className={active ? "text-white/90" : "text-[var(--muted)]"}>
                ({formatNumber(count)})
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-3 text-xs text-[var(--muted)]">
        {selectedCountry === "All"
          ? "All countries"
          : `Showing partners for ${selectedCountry}`}
        {" · "}
        {formatNumber(orderCount)} orders assigned
        {" · "}
        Labels show volume and % delivered (status = Delivered)
      </p>

      <BarChartCard
        title="By delivery partner"
        data={chartRows}
        showDataLabels
        showAllCategoryLabels
        categoryAxisWidth={120}
        dataLabelKey="chartLabel"
        embedded
      />
    </ChartCardShell>
  );
}
