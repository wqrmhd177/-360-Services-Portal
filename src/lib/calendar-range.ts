import type { DateRange } from "@/lib/types/order";

/**
 * URL `from` / `to` (yyyy-MM-dd) are UTC calendar days.
 * Matches Metabase `Order_date` (UTC) and production behaviour (~12 for 2026-05-19).
 */
export const PORTAL_TIMEZONE = "UTC";

function parseYmd(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${dateStr}`);
  return { y, m, d };
}

/**
 * Inclusive day bounds for yyyy-MM-dd strings as UTC calendar dates.
 * e.g. 2026-05-19 → 2026-05-19T00:00:00.000Z … 2026-05-19T23:59:59.999Z
 */
export function calendarDayBoundsFromStrings(fromStr: string, toStr: string) {
  const from = parseYmd(fromStr);
  const to = parseYmd(toStr);
  const fromMs = Date.UTC(from.y, from.m - 1, from.d, 0, 0, 0, 0);
  const toMs = Date.UTC(to.y, to.m - 1, to.d, 23, 59, 59, 999);
  return {
    fromMs,
    toMs,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    fromDate: fromStr,
    toDate: toStr,
  };
}

/** Serialize picker/local calendar picks to URL date params (yyyy-MM-dd). */
export function dateRangeFromPickerDates(from: Date, to: Date): DateRange {
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`;
  return dateRangeFromParamStrings(fromStr, toStr);
}

export function calendarRangeBounds(range: DateRange) {
  return calendarDayBoundsFromStrings(range.fromDate, range.toDate);
}

export function isInstantInCalendarRange(instant: Date, range: DateRange): boolean {
  const { fromMs, toMs } = calendarRangeBounds(range);
  const t = instant.getTime();
  return t >= fromMs && t <= toMs;
}

/** Build DateRange from URL yyyy-MM-dd params. */
export function dateRangeFromParamStrings(fromStr: string, toStr: string): DateRange {
  const { fromMs, toMs, fromDate, toDate } = calendarDayBoundsFromStrings(
    fromStr,
    toStr,
  );
  return {
    from: new Date(fromMs),
    to: new Date(toMs),
    fromDate,
    toDate,
  };
}
