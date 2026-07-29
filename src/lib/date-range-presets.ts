import { dateRangeFromParamStrings } from "@/lib/calendar-range";
import {
  addPortalCalendarDays,
  formatPortalYmdLabel,
  portalCalendarDay,
  portalMonthStartYmd,
  previousPortalMonthRange,
  todayInPortalTz,
  zonedDateTimeParts,
  zonedDayStartMs,
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

function portalDayFromYmd(ymd: string) {
  return zonedDateTimeParts(new Date(zonedDayStartMs(ymd))).day;
}

export function formatDisplayDateFromYmd(ymd: string) {
  return formatPortalYmdLabel(ymd, DISPLAY_DATE_FORMAT);
}

export function formatRangeLabelFromStrings(fromDate: string, toDate: string) {
  return `${formatDisplayDateFromYmd(fromDate)} to ${formatDisplayDateFromYmd(toDate)}`;
}

export function formatCompactRangeLabelFromStrings(fromDate: string, toDate: string) {
  const sameMonth = fromDate.slice(0, 7) === toDate.slice(0, 7);
  if (sameMonth) {
    const month = formatPortalYmdLabel(fromDate, { month: "short" });
    const fromDay = portalDayFromYmd(fromDate);
    const toDay = portalDayFromYmd(toDate);
    return `${month} ${fromDay}–${toDay}`;
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
