"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  TitleAccountManagerSplit,
  TitleBreakdownRow,
  TitleCountrySplit,
} from "@/lib/analytics/orders";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

interface MetricRow {
  orders: number;
  deliveryRatio: number;
  units: number;
  pct: number;
}

const LEVEL_INDENT = ["", "pl-3 sm:pl-4", "pl-6 sm:pl-8", "pl-9 sm:pl-12"] as const;

function MetricCells({
  row,
  muted = false,
  compact = false,
}: {
  row: MetricRow;
  muted?: boolean;
  compact?: boolean;
}) {
  const cellClass = cn(
    compact ? "px-3 py-2" : "px-4 py-2.5",
    "text-right tabular-nums whitespace-nowrap",
    muted && "text-[var(--muted)]",
  );
  return (
    <>
      <td className={cellClass}>{formatNumber(row.orders)}</td>
      <td className={cellClass}>{formatPercent(row.deliveryRatio)}</td>
      <td className={cellClass}>{formatNumber(row.units)}</td>
      <td className={cellClass}>{formatPercent(row.pct)}</td>
    </>
  );
}

function metricInlineTitle(row: MetricRow) {
  return `Orders ${formatNumber(row.orders)}, Delivery ${formatPercent(row.deliveryRatio)}, Units ${formatNumber(row.units)}, Share ${formatPercent(row.pct)}`;
}

function MetricInline({
  row,
  muted = false,
}: {
  row: MetricRow;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "shrink-0 text-[11px] leading-none tabular-nums",
        muted ? "text-[var(--muted)]" : "text-[var(--foreground)]",
      )}
      title={metricInlineTitle(row)}
    >
      {formatNumber(row.orders)}
      <span className="mx-0.5 opacity-35">·</span>
      {formatPercent(row.deliveryRatio)}
      <span className="mx-0.5 opacity-35">·</span>
      {formatNumber(row.units)}u
      <span className="mx-0.5 opacity-35">·</span>
      {formatPercent(row.pct)}
    </span>
  );
}

function ExpandToggle({
  isOpen,
  size = "md",
  className,
}: {
  isOpen: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center text-[var(--muted)] transition-transform",
        box,
        isOpen && "rotate-180",
        className,
      )}
      aria-hidden
    >
      <ChevronDown className={icon} strokeWidth={2.25} />
    </span>
  );
}

function TitleFilter({
  titles,
  value,
  onChange,
}: {
  titles: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return titles;
    return titles.filter((t) => t.toLowerCase().includes(q));
  }, [titles, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const displayLabel = value ?? "All products";

  return (
    <div ref={rootRef} className="relative w-full sm:max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-left text-sm text-[var(--foreground)] shadow-sm transition-colors hover:border-[var(--foreground)]/30 focus:border-[var(--foreground)] focus:outline-none"
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          id={listId}
          className="absolute right-0 z-20 mt-1.5 w-full min-w-[16rem] overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card)] shadow-lg"
        >
          <div className="border-b border-[var(--card-border)] p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              autoFocus
              className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--foreground)] focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--table-header)]",
                  value === null && "bg-[var(--table-header)] font-medium",
                )}
              >
                All products
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--muted)]">
                No products match your search.
              </li>
            ) : (
              filtered.map((title) => (
                <li key={title}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === title}
                    onClick={() => {
                      onChange(title);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--table-header)]",
                      value === title && "bg-[var(--table-header)] font-medium",
                    )}
                  >
                    <span className="line-clamp-2">{title}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ExpandableNameCell({
  name,
  level,
  isOpen,
  onToggle,
  muted = false,
}: {
  name: string;
  level: 0 | 1 | 2;
  isOpen: boolean;
  onToggle: () => void;
  muted?: boolean;
}) {
  return (
    <td className={cn("px-3 py-2.5 sm:px-4", LEVEL_INDENT[level])}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 text-left transition-colors hover:text-[var(--foreground)]",
          level === 0 ? "font-semibold" : "font-medium",
          muted && "text-[var(--muted)]",
        )}
      >
        <ExpandToggle isOpen={isOpen} />
        <span className="min-w-0 truncate" title={name}>
          {name}
        </span>
      </button>
    </td>
  );
}

function CountryRows({
  titleKey,
  amKey,
  countries,
}: {
  titleKey: string;
  amKey: string;
  countries: TitleCountrySplit[];
}) {
  return countries.map((country) => (
    <tr
      key={`${titleKey}|${amKey}|${country.name}`}
      className="border-b border-[var(--card-border)]/60 bg-[var(--table-header)]/20 last:border-0"
    >
      <td
        className={cn(
          "px-3 py-2 sm:px-4",
          LEVEL_INDENT[3],
          "text-sm text-[var(--muted)]",
        )}
      >
        <span className="block truncate" title={country.name}>
          {country.name}
        </span>
      </td>
      <MetricCells row={country} muted compact />
    </tr>
  ));
}

function AccountManagerRows({
  titleKey,
  splits,
  expanded,
  onToggle,
}: {
  titleKey: string;
  splits: TitleAccountManagerSplit[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  return splits.map((split) => {
    const amKey = `${titleKey}|am:${split.name}`;
    const isAmOpen = expanded.has(amKey);
    const countries = split.countrySplits;
    const canExpandCountries = countries.length > 0;

    return (
      <Fragment key={amKey}>
        <tr className="border-b border-[var(--card-border)]/60 bg-[var(--table-header)]/35">
          {canExpandCountries ? (
            <ExpandableNameCell
              name={split.name}
              level={1}
              isOpen={isAmOpen}
              onToggle={() => onToggle(amKey)}
              muted
            />
          ) : (
            <td
              className={cn(
                "px-3 py-2.5 text-sm text-[var(--muted)] sm:px-4",
                LEVEL_INDENT[1],
              )}
            >
              <span className="block truncate" title={split.name}>
                {split.name}
              </span>
            </td>
          )}
          <MetricCells row={split} muted compact />
        </tr>
        {isAmOpen && canExpandCountries ? (
          <CountryRows titleKey={titleKey} amKey={amKey} countries={countries} />
        ) : null}
      </Fragment>
    );
  });
}

function TitleTableRow({
  row,
  expanded,
  onToggle,
  autoExpand,
}: {
  row: TitleBreakdownRow;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  autoExpand?: boolean;
}) {
  const titleKey = `t:${row.name}`;
  const isTitleOpen = autoExpand || expanded.has(titleKey);
  const accountManagers = row.accountManagerSplits;
  const canExpandTitle = accountManagers.length > 0;

  return (
    <Fragment key={titleKey}>
      <tr className="border-b border-[var(--card-border)] hover:bg-[var(--table-header)]/40">
        {canExpandTitle ? (
          <ExpandableNameCell
            name={row.name}
            level={0}
            isOpen={isTitleOpen}
            onToggle={() => onToggle(titleKey)}
          />
        ) : (
          <td className="px-3 py-2.5 font-semibold sm:px-4">
            <span className="block truncate" title={row.name}>
              {row.name}
            </span>
          </td>
        )}
        <MetricCells row={row} compact />
      </tr>
      {isTitleOpen && canExpandTitle ? (
        <AccountManagerRows
          titleKey={titleKey}
          splits={accountManagers}
          expanded={expanded}
          onToggle={onToggle}
        />
      ) : null}
    </Fragment>
  );
}


function MobileCountryRows({ countries }: { countries: TitleCountrySplit[] }) {
  return countries.map((country) => (
    <li
      key={country.name}
      className="flex min-h-7 items-center gap-1 border-l border-[var(--card-border)] py-0.5 pl-5 pr-2"
    >
      <span
        className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)]"
        title={country.name}
      >
        {country.name}
      </span>
      <MetricInline row={country} muted />
    </li>
  ));
}

function MobileAccountManagerRows({
  titleKey,
  splits,
  expanded,
  onToggle,
}: {
  titleKey: string;
  splits: TitleAccountManagerSplit[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  return splits.map((split) => {
    const amKey = `${titleKey}|am:${split.name}`;
    const isAmOpen = expanded.has(amKey);
    const countries = split.countrySplits;
    const canExpand = countries.length > 0;

    return (
      <Fragment key={amKey}>
        <li className="border-l border-[var(--card-border)]">
          <button
            type="button"
            onClick={() => canExpand && onToggle(amKey)}
            aria-expanded={canExpand ? isAmOpen : undefined}
            className={cn(
              "flex min-h-8 w-full items-center gap-1 py-1 pl-3 pr-2 text-left",
              !canExpand && "cursor-default",
            )}
          >
            {canExpand ? (
              <ExpandToggle isOpen={isAmOpen} size="sm" />
            ) : (
              <span className="h-5 w-5 shrink-0" aria-hidden />
            )}
            <span
              className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--foreground)]"
              title={split.name}
            >
              {split.name}
            </span>
            <MetricInline row={split} muted />
          </button>
        </li>
        {isAmOpen && canExpand ? (
          <MobileCountryRows countries={countries} />
        ) : null}
      </Fragment>
    );
  });
}

function TitleMobileRow({
  row,
  expanded,
  onToggle,
  autoExpand,
}: {
  row: TitleBreakdownRow;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  autoExpand?: boolean;
}) {
  const titleKey = `t:${row.name}`;
  const isTitleOpen = autoExpand || expanded.has(titleKey);
  const accountManagers = row.accountManagerSplits;
  const canExpand = accountManagers.length > 0;

  return (
    <div className="border-b border-[var(--card-border)] last:border-0">
      <button
        type="button"
        onClick={() => canExpand && onToggle(titleKey)}
        aria-expanded={canExpand ? isTitleOpen : undefined}
        className={cn(
          "flex min-h-9 w-full items-center gap-1 px-2 py-1.5 text-left",
          !canExpand && "cursor-default",
        )}
      >
        {canExpand ? (
          <ExpandToggle isOpen={isTitleOpen} size="sm" />
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden />
        )}
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)]"
          title={row.name}
        >
          {row.name}
        </span>
        <MetricInline row={row} />
      </button>
      {isTitleOpen && canExpand ? (
        <ul className="pb-0.5">
          <MobileAccountManagerRows
            titleKey={titleKey}
            splits={accountManagers}
            expanded={expanded}
            onToggle={onToggle}
          />
        </ul>
      ) : null}
    </div>
  );
}


export function ProductPerformanceTable({
  title,
  rows,
}: {
  title: string;
  rows: TitleBreakdownRow[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  const titleOptions = useMemo(
    () => rows.map((row) => row.name).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    if (!selectedTitle) return rows;
    return rows.filter((row) => row.name === selectedTitle);
  }, [rows, selectedTitle]);

  const singleTitleSelected = selectedTitle != null;

  useEffect(() => {
    if (!singleTitleSelected || filteredRows.length !== 1) return;
    const row = filteredRows[0];
    const titleKey = `t:${row.name}`;
    const keys = new Set<string>([titleKey]);
    for (const am of row.accountManagerSplits) {
      if (am.countrySplits.length > 0) {
        keys.add(`${titleKey}|am:${am.name}`);
      }
    }
    setExpanded(keys);
  }, [singleTitleSelected, filteredRows]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearFilter = () => setSelectedTitle(null);

  return (
    <Card>
      <CardHeader className="space-y-3 pb-4 sm:space-y-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            {selectedTitle ? (
              <p className="text-xs text-[var(--muted)]">
                Showing 1 product
                <button
                  type="button"
                  onClick={clearFilter}
                  className="ml-2 inline-flex items-center gap-0.5 font-medium text-teal-600 hover:underline dark:text-teal-400"
                >
                  Clear
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                {filteredRows.length} product{filteredRows.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <TitleFilter
            titles={titleOptions}
            value={selectedTitle}
            onChange={setSelectedTitle}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0 sm:px-6 sm:pb-6">
        {filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-0">
            No products match this filter.
          </p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--card-border)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 z-10 border-b border-[var(--card-border)] bg-[var(--table-header)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-3 sm:px-4">Product</th>
                    <th className="px-3 py-3 text-right sm:px-4">Orders</th>
                    <th className="px-3 py-3 text-right sm:px-4">Delivery %</th>
                    <th className="px-3 py-3 text-right sm:px-4">Units</th>
                    <th className="px-3 py-3 text-right sm:px-4">%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <TitleTableRow
                      key={row.name}
                      row={row}
                      expanded={expanded}
                      onToggle={toggle}
                      autoExpand={singleTitleSelected}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-[var(--card-border)] md:hidden">
              <p className="border-b border-[var(--card-border)] px-2 py-0.5 text-[9px] text-[var(--muted)]">
                Tap to expand · metrics: orders · delivery · units · share
              </p>
              {filteredRows.map((row) => (
                <TitleMobileRow
                  key={row.name}
                  row={row}
                  expanded={expanded}
                  onToggle={toggle}
                  autoExpand={singleTitleSelected}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
