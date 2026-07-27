import type { DateRange } from "@/lib/types/order";
import {
  PORTAL_TIMEZONE,
  portalCalendarDay,
  zonedDayEndMs,
  zonedDayStartMs,
} from "@/lib/portalTimezone";

export { PORTAL_TIMEZONE };

function parseYmd(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${dateStr}`);
  return { y, m, d };
}

/**
 * URL `from` / `to` (yyyy-MM-dd) are PST/PDT calendar days (America/Los_Angeles).
 * Matches order_date_day in ops_orders_items and order_date_day_pst in SKU Performance.
 */
export function calendarDayBoundsFromStrings(fromStr: string, toStr: string) {
  parseYmd(fromStr);
  parseYmd(toStr);
  const fromMs = zonedDayStartMs(fromStr);
  const toMs = zonedDayEndMs(toStr);
  return {
    fromMs,
    toMs,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    fromDate: fromStr,
    toDate: toStr,
  };
}

/** Serialize preset/picker Date bounds to URL date params (PST calendar days). */
export function dateRangeFromPickerDates(from: Date, to: Date): DateRange {
  return dateRangeFromParamStrings(portalCalendarDay(from), portalCalendarDay(to));
}

export function calendarRangeBounds(range: DateRange) {
  return calendarDayBoundsFromStrings(range.fromDate, range.toDate);
}

export function isInstantInCalendarRange(instant: Date, range: DateRange): boolean {
  const { fromMs, toMs } = calendarRangeBounds(range);
  const t = instant.getTime();
  return t >= fromMs && t <= toMs;
}

/** Build DateRange from URL yyyy-MM-dd params (PST calendar days). */
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
