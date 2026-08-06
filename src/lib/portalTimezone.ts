/**
 * Portal reporting timezone — all Operations date filters and order-day columns use PST/PDT.
 */
export const PORTAL_TIMEZONE = "America/Los_Angeles";
export const PORTAL_TIMEZONE_LABEL = "PST";

export function calendarDayInTimezone(
  instant: Date,
  timeZone: string = PORTAL_TIMEZONE,
): string {
  return instant.toLocaleDateString("en-CA", { timeZone });
}

/** Alias used by order sync and analytics bucketing. */
export function portalCalendarDay(instant: Date): string {
  return calendarDayInTimezone(instant);
}

export function todayInPortalTz(): string {
  return portalCalendarDay(new Date());
}

export function zonedDateTimeParts(
  instant: Date,
  timeZone: string = PORTAL_TIMEZONE,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function zonedInstantFromParts(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  s: number,
  ms: number,
  timeZone: string = PORTAL_TIMEZONE,
): number {
  const target = Date.UTC(y, m - 1, d, h, min, s, ms);
  let lo = target - 26 * 60 * 60 * 1000;
  let hi = target + 26 * 60 * 60 * 1000;

  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = zonedDateTimeParts(new Date(mid), timeZone);
    const cmp =
      p.year !== y
        ? p.year - y
        : p.month !== m
          ? p.month - m
          : p.day !== d
            ? p.day - d
            : p.hour !== h
              ? p.hour - h
              : p.minute !== min
                ? p.minute - min
                : p.second - s;
    if (cmp < 0) lo = mid + 1;
    else hi = mid;
  }

  return lo;
}

export function zonedDayStartMs(
  ymd: string,
  timeZone: string = PORTAL_TIMEZONE,
): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return zonedInstantFromParts(y, m, d, 0, 0, 0, 0, timeZone);
}

export function zonedDayEndMs(
  ymd: string,
  timeZone: string = PORTAL_TIMEZONE,
): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return zonedInstantFromParts(y, m, d, 23, 59, 59, 999, timeZone);
}

/** Add calendar days to a yyyy-MM-dd string (timezone-agnostic day arithmetic). */
export function addPortalCalendarDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

export function portalMonthStartYmd(): string {
  const { year, month } = zonedDateTimeParts(new Date());
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function previousPortalMonthRange(): { from: string; to: string } {
  const thisMonthStart = portalMonthStartYmd();
  const lastDayPrev = addPortalCalendarDays(thisMonthStart, -1);
  const from = `${lastDayPrev.slice(0, 8)}01`;
  return { from, to: lastDayPrev };
}

/** Inclusive list of yyyy-MM-dd strings from fromYmd through toYmd. */
export function eachPortalCalendarDay(fromYmd: string, toYmd: string): string[] {
  const days: string[] = [];
  for (let d = fromYmd; d <= toYmd; d = addPortalCalendarDays(d, 1)) {
    days.push(d);
  }
  return days;
}

export function formatPortalTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: PORTAL_TIMEZONE,
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** User-friendly sync label for portal pages (Pacific Time). */
export function formatPortalSyncLabel(
  iso: string | null | undefined,
  prefix: string,
): string | null {
  if (!iso) return null;
  return `${prefix}: ${formatPortalTimestamp(iso)}`;
}

/** Format a portal yyyy-MM-dd calendar day in PST/PDT (not browser local or UTC). */
export function formatPortalYmdLabel(
  ymd: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-GB",
): string {
  const instant = new Date(zonedDayStartMs(ymd));
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: PORTAL_TIMEZONE,
  }).format(instant);
}

export function formatPortalYmdShort(ymd: string): string {
  return formatPortalYmdLabel(ymd, { month: "short", day: "numeric" });
}

export function formatPortalYmdMedium(ymd: string): string {
  return formatPortalYmdLabel(ymd, { dateStyle: "medium" });
}

/** @deprecated Use formatPortalTimestamp */
export const formatPstTimestamp = formatPortalTimestamp;
