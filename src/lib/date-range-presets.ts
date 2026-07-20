import {
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { dateRangeFromParamStrings } from "@/lib/calendar-range";
import type { DateRange } from "@/lib/types/order";

export interface DateRangeValue {
  from: Date;
  to: Date;
}

export interface QuickSelectPreset {
  id: string;
  label: string;
  getRange: () => DateRangeValue;
}

export const QUICK_SELECT_PRESETS: QuickSelectPreset[] = [
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const d = new Date();
      return { from: startOfDay(d), to: endOfDay(d) };
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const d = subDays(new Date(), 1);
      return { from: startOfDay(d), to: endOfDay(d) };
    },
  },
  {
    id: "last7",
    label: "Last 7 Days",
    getRange: () => {
      const to = endOfDay(new Date());
      const from = startOfDay(subDays(to, 6));
      return { from, to };
    },
  },
  {
    id: "last14",
    label: "Last 14 Days",
    getRange: () => {
      const to = endOfDay(new Date());
      const from = startOfDay(subDays(to, 13));
      return { from, to };
    },
  },
  {
    id: "last30",
    label: "Last 30 Days",
    getRange: () => {
      const to = endOfDay(new Date());
      const from = startOfDay(subDays(to, 29));
      return { from, to };
    },
  },
  {
    id: "thisMonth",
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return { from: startOfMonth(now), to: endOfDay(now) };
    },
  },
  {
    id: "lastMonth",
    label: "Last Month",
    getRange: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfDay(endOfMonth(prev)) };
    },
  },
];

export function defaultDateRange(): DateRangeValue {
  return QUICK_SELECT_PRESETS.find((p) => p.id === "thisMonth")!.getRange();
}

/** Stock Cover Days: 1 Jan (current year) through today. */
export function defaultStockCoverDaysDateRange(): DateRangeValue {
  const now = new Date();
  return { from: startOfYear(now), to: endOfDay(now) };
}

const DISPLAY_DATE_FORMAT = "dd MMM yy";

export function formatDisplayDate(date: Date) {
  return format(date, DISPLAY_DATE_FORMAT);
}

export function formatRangeLabel(from: Date, to: Date) {
  return `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`;
}

/** Labels from URL yyyy-MM-dd strings — avoids local-TZ shift on UTC day bounds. */
export function formatRangeLabelFromStrings(fromDate: string, toDate: string) {
  return formatRangeLabel(parseISO(fromDate), parseISO(toDate));
}

const COMPACT_DATE_FORMAT = "MMM d";

export function formatCompactRangeLabel(from: Date, to: Date) {
  if (isSameMonth(from, to)) {
    return `${format(from, COMPACT_DATE_FORMAT)}–${format(to, "d")}`;
  }
  return `${format(from, COMPACT_DATE_FORMAT)} – ${format(to, COMPACT_DATE_FORMAT)}`;
}

/** Compact label from URL yyyy-MM-dd strings — avoids +1 day display in UTC+ timezones. */
export function formatCompactRangeLabelFromStrings(fromDate: string, toDate: string) {
  return formatCompactRangeLabel(parseISO(fromDate), parseISO(toDate));
}

export function toInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function rangesMatch(a: DateRangeValue, b: DateRangeValue) {
  return isSameDay(a.from, b.from) && isSameDay(a.to, b.to);
}

export function rangesMatchStrings(a: DateRange, b: DateRange) {
  return a.fromDate === b.fromDate && a.toDate === b.toDate;
}

export function findMatchingPresetId(range: DateRangeValue): string | null {
  for (const preset of QUICK_SELECT_PRESETS) {
    if (rangesMatch(range, preset.getRange())) return preset.id;
  }
  return null;
}

export function findMatchingPresetIdFromRange(range: DateRange): string | null {
  for (const preset of QUICK_SELECT_PRESETS) {
    const pr = dateRangeFromParamStrings(
      toInputValue(preset.getRange().from),
      toInputValue(preset.getRange().to),
    );
    if (rangesMatchStrings(range, pr)) return preset.id;
  }
  return null;
}

export function parseRangeFromSearchParams(
  fromStr?: string | null,
  toStr?: string | null,
  fallback: DateRangeValue = defaultDateRange(),
): DateRange {
  if (fromStr && toStr) {
    try {
      return dateRangeFromParamStrings(fromStr, toStr);
    } catch {
      return dateRangeFromParamStrings(
        toInputValue(fallback.from),
        toInputValue(fallback.to),
      );
    }
  }
  return dateRangeFromParamStrings(
    toInputValue(fallback.from),
    toInputValue(fallback.to),
  );
}
