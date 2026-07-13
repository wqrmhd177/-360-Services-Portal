import { format } from "date-fns";
import type { DateRange, OrderFilters } from "@/lib/types/order";
import { dateRangeFromParamStrings } from "@/lib/calendar-range";
import type { DateRangeValue } from "@/lib/date-range-presets";
import {
  defaultDateRange,
  parseRangeFromSearchParams,
} from "@/lib/date-range-presets";

const DATE_SEARCH_PARAM_KEYS = ["from", "to", "range"] as const;

/** @deprecated Overview removed; always uses full page filters when present. */
export function isOrdersOverviewPath(_pathname: string): boolean {
  return false;
}

/** Server searchParams with only date-range keys (Overview ignores store/country/title). */
export function pickDateSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};
  for (const key of DATE_SEARCH_PARAM_KEYS) {
    if (searchParams[key] !== undefined) result[key] = searchParams[key];
  }
  return result;
}

/** URLSearchParams with only date-range keys. */
export function toDateOnlySearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of DATE_SEARCH_PARAM_KEYS) {
    const value = searchParams.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

/** Calendar date in local time — matches DateRangePicker URL params. */
export function formatDateParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function serializeDateRange(range: DateRange): {
  from: string;
  to: string;
} {
  return {
    from: range.fromDate,
    to: range.toDate,
  };
}

function searchParamsRecord(
  searchParams: URLSearchParams,
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

/**
 * Query string for status-detail API: date range (and page filters when not Overview),
 * without `status` (facet) so the clicked status is not double-filtered.
 */
export function buildStatusDetailSearchParams(
  searchParams: URLSearchParams,
  statusName: string,
  options?: { dateOnly?: boolean },
): URLSearchParams {
  const base = options?.dateOnly
    ? toDateOnlySearchParams(searchParams)
    : new URLSearchParams(searchParams.toString());
  base.delete("status");
  base.set("statusName", statusName);

  const range = parseDateRange(searchParamsRecord(base));
  const { from, to } = serializeDateRange(range);
  base.set("from", from);
  base.set("to", to);

  return base;
}

/**
 * Query string for account-manager-detail API: date range (and page filters when not Overview),
 * without `am` so the selected account manager is not double-filtered.
 */
export function buildAccountManagerDetailSearchParams(
  searchParams: URLSearchParams,
  accountManagerName: string,
  options?: { dateOnly?: boolean },
): URLSearchParams {
  const base = options?.dateOnly
    ? toDateOnlySearchParams(searchParams)
    : new URLSearchParams(searchParams.toString());
  base.delete("am");
  base.set("accountManagerName", accountManagerName);

  const range = parseDateRange(searchParamsRecord(base));
  const { from, to } = serializeDateRange(range);
  base.set("from", from);
  base.set("to", to);

  return base;
}

export function parseDateRange(
  searchParams: Record<string, string | string[] | undefined>,
  options?: { defaultRange?: () => DateRangeValue },
): DateRange {
  const fromStr =
    typeof searchParams.from === "string" ? searchParams.from : null;
  const toStr = typeof searchParams.to === "string" ? searchParams.to : null;
  const fallback = options?.defaultRange?.() ?? defaultDateRange();

  if (fromStr && toStr) {
    return parseRangeFromSearchParams(fromStr, toStr, fallback);
  }

  return dateRangeFromParamStrings(
    formatDateParam(fallback.from),
    formatDateParam(fallback.to),
  );
}

function parseList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value.join(",") : value;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

function parseStoreIds(
  value: string | string[] | undefined,
): number[] | undefined {
  const list = parseList(value);
  if (!list) return undefined;
  const ids = list.map((s) => Number(s)).filter((n) => Number.isFinite(n));
  return ids.length ? ids : undefined;
}

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>
): OrderFilters {
  return {
    countries: parseList(searchParams.country),
    statuses: parseList(searchParams.status),
    bifurcations: parseList(searchParams.bifurcation),
    platforms: parseList(searchParams.platform),
    accountManagers: parseList(searchParams.am),
    deliveryPartners: parseList(searchParams.partner),
    sku: typeof searchParams.sku === "string" ? searchParams.sku : undefined,
    storeIds: parseStoreIds(searchParams.store_id),
    titles: parseList(searchParams.title),
  };
}

export function buildFilterQuery(range: DateRange, filters: OrderFilters) {
  const p = new URLSearchParams();
  const { from, to } = serializeDateRange(range);
  p.set("from", from);
  p.set("to", to);
  if (filters.countries?.length) p.set("country", filters.countries.join(","));
  if (filters.statuses?.length) p.set("status", filters.statuses.join(","));
  if (filters.bifurcations?.length)
    p.set("bifurcation", filters.bifurcations.join(","));
  if (filters.platforms?.length) p.set("platform", filters.platforms.join(","));
  if (filters.accountManagers?.length)
    p.set("am", filters.accountManagers.join(","));
  if (filters.deliveryPartners?.length)
    p.set("partner", filters.deliveryPartners.join(","));
  if (filters.sku) p.set("sku", filters.sku);
  if (filters.storeIds?.length)
    p.set("store_id", filters.storeIds.join(","));
  if (filters.titles?.length) {
    for (const title of filters.titles) p.append("title", title);
  }
  return p.toString();
}

export { defaultDateRange };
