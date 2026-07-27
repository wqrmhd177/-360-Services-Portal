import { parseISO } from "date-fns";
import { dateRangeFromParamStrings } from "@/lib/calendar-range";
import {
  addPortalCalendarDays,
  portalCalendarDay,
  portalMonthStartYmd,
  previousPortalMonthRange,
  todayInPortalTz,
} from "@/lib/portalTimezone";
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

function portalPresetRange(fromYmd: string, toYmd: string): DateRangeValue {
  const range = dateRangeFromParamStrings(fromYmd, toYmd);
  return { from: range.from, to: range.to };
}

function presetToDateRange(preset: QuickSelectPreset): DateRange {
  const { from, to } = preset.getRange();
  return dateRangeFromParamStrings(portalCalendarDay(from), portalCalendarDay(to));
}

export const QUICK_SELECT_PRESETS: QuickSelectPreset[] = [
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const today = todayInPortalTz();
      return portalPresetRange(today, today);
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const day = addPortalCalendarDays(todayInPortalTz(), -1);
      return portalPresetRange(day, day);
    },
  },
  {
    id: "last7",
    label: "Last 7 Days",
    getRange: () => {
      const to = todayInPortalTz();
      const from = addPortalCalendarDays(to, -6);
      return portalPresetRange(from, to);
    },
  },
  {
    id: "last14",
    label: "Last 14 Days",
    getRange: () => {
      const to = todayInPortalTz();
      const from = addPortalCalendarDays(to, -13);
      return portalPresetRange(from, to);
    },
  },
  {
    id: "last30",
    label: "Last 30 Days",
    getRange: () => {
      const to = todayInPortalTz();
      const from = addPortalCalendarDays(to, -29);
      return portalPresetRange(from, to);
    },
  },
  {
    id: "thisMonth",
    label: "This Month",
    getRange: () => {
      const from = portalMonthStartYmd();
      const to = todayInPortalTz();
      return portalPresetRange(from, to);
    },
  },
  {
    id: "lastMonth",
    label: "Last Month",
    getRange: () => {
      const { from, to } = previousPortalMonthRange();
      return portalPresetRange(from, to);
    },
  },
];

export function defaultDateRange(): DateRangeValue {
  return QUICK_SELECT_PRESETS.find((p) => p.id === "thisMonth")!.getRange();
}

/** Stock Cover Days: 1 Jan (current PST year) through today. */
export function defaultStockCoverDaysDateRange(): DateRangeValue {
  const year = portalMonthStartYmd().slice(0, 4);
  return portalPresetRange(`${year}-01-01`, todayInPortalTz());
}

const DISPLAY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "2-digit",
};

export function formatDisplayDateFromYmd(ymd: string) {
  return new Intl.DateTimeFormat("en-GB", DISPLAY_DATE_FORMAT).format(parseISO(ymd));
}

export function formatRangeLabelFromStrings(fromDate: string, toDate: string) {
  return `${formatDisplayDateFromYmd(fromDate)} to ${formatDisplayDateFromYmd(toDate)}`;
}

export function formatCompactRangeLabelFromStrings(fromDate: string, toDate: string) {
  const from = parseISO(fromDate);
  const to = parseISO(toDate);
  const sameMonth = fromDate.slice(0, 7) === toDate.slice(0, 7);
  if (sameMonth) {
    const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(from);
    return `${month} ${from.getUTCDate()}–${to.getUTCDate()}`;
  }
  return `${formatDisplayDateFromYmd(fromDate)} – ${formatDisplayDateFromYmd(toDate)}`;
}

export function toInputValue(date: Date) {
  return portalCalendarDay(date);
}

export function rangesMatchStrings(a: DateRange, b: DateRange) {
  return a.fromDate === b.fromDate && a.toDate === b.toDate;
}

export function findMatchingPresetIdFromRange(range: DateRange): string | null {
  for (const preset of QUICK_SELECT_PRESETS) {
    if (rangesMatchStrings(range, presetToDateRange(preset))) return preset.id;
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
      /* use fallback */
    }
  }
  return dateRangeFromParamStrings(
    portalCalendarDay(fallback.from),
    portalCalendarDay(fallback.to),
  );
}
