"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseRevenueLossTagDispatchLabel,
  REVENUE_LOSS_DISPATCH_LABELS,
  type RevenueLossRow,
} from "@/lib/analytics/orders";
import { cn, formatNumber, formatPercent, formatUsd } from "@/lib/utils";

function RevenueLossChildLabel({ label }: { label: string }) {
  const parsed = parseRevenueLossTagDispatchLabel(label);
  if (!parsed) {
    return <span>{label}</span>;
  }

  const isPre = parsed.dispatch === REVENUE_LOSS_DISPATCH_LABELS.pre;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="text-[var(--foreground)]">{parsed.tag}</span>
      <span className="text-[var(--muted)]" aria-hidden>
        -
      </span>
      <span
        className={cn(
          "inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
          isPre
            ? "bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300"
            : "bg-sky-500/15 text-sky-800 ring-sky-500/30 dark:text-sky-300",
        )}
      >
        {parsed.dispatch}
      </span>
    </span>
  );
}

function rowExpandKey(row: RevenueLossRow) {
  return `${row.kind}:${row.name}`;
}

export function RevenueLossTable({
  title,
  rows,
}: {
  title: string;
  rows: RevenueLossRow[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="-mx-3 overflow-x-auto p-0 px-3 sm:mx-0 sm:px-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-[var(--table-header)] text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Revenue (USD)</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowExpandKey(row);
              const isOpen = expanded.has(key);
              const tagChildren = row.tagSplits ?? [];
              const statusChildren = row.statusSplits ?? [];
              const canExpand =
                row.kind === "group" ||
                tagChildren.length > 0 ||
                statusChildren.length > 0;

              return (
                <Fragment key={key}>
                  <tr className="border-b">
                    <td className="px-4 py-2">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          aria-expanded={isOpen}
                          className={cn(
                            "flex w-full items-center gap-2 text-left font-medium transition-colors",
                            row.kind === "group"
                              ? "text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
                              : "text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] transition-transform",
                              isOpen && "rotate-180",
                            )}
                            aria-hidden
                          >
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                          <span className="min-w-0">{row.name}</span>
                        </button>
                      ) : (
                        <span className="font-medium">{row.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatNumber(row.orders)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatUsd(row.revenue)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatNumber(row.units)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatPercent(row.pct)}
                    </td>
                  </tr>
                  {isOpen && row.kind === "group" && tagChildren.length === 0 ? (
                    <tr className="border-b bg-[var(--table-header)]/50">
                      <td
                        colSpan={5}
                        className="py-3 pl-14 pr-4 text-center text-sm text-[var(--muted)]"
                      >
                        No orders for this group in the selected range.
                      </td>
                    </tr>
                  ) : null}
                  {isOpen && tagChildren.length > 0
                    ? tagChildren.map((split) => (
                        <tr
                          key={`${key}-${split.name}`}
                          className="border-b bg-[var(--table-header)]/50"
                        >
                          <td className="py-2 pl-14 pr-4">
                            <RevenueLossChildLabel label={split.name} />
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatNumber(split.orders)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatUsd(split.revenue)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatNumber(split.units)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatPercent(split.pct)}
                          </td>
                        </tr>
                      ))
                    : null}
                  {isOpen && statusChildren.length > 0
                    ? statusChildren.map((split) => (
                        <tr
                          key={`${key}-${split.status}`}
                          className="border-b bg-[var(--table-header)]/50"
                        >
                          <td className="py-2 pl-14 pr-4">
                            <RevenueLossChildLabel label={split.status} />
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatNumber(split.orders)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatUsd(split.revenue)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatNumber(split.units)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-[var(--muted)]">
                            {formatPercent(split.pct)}
                          </td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
