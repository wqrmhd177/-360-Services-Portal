/**
 * Reproduce date-range display off-by-one (UTC URL vs local format).
 * Run: npx tsx scripts/debug-date-range-tz-75f7fa.ts
 */
import fs from "fs";
import path from "path";
import { format, endOfDay, parseISO } from "date-fns";
import { dateRangeFromParamStrings } from "../src/lib/calendar-range";
import {
  formatCompactRangeLabel,
  formatCompactRangeLabelFromStrings,
  formatRangeLabel,
  toInputValue,
} from "../src/lib/date-range-presets";

const LOG = path.join(process.cwd(), "debug-75f7fa.log");

function log(message: string, data: Record<string, unknown>, hypothesisId: string) {
  const entry = {
    sessionId: "75f7fa",
    runId: "date-tz-repro",
    hypothesisId,
    location: "debug-date-range-tz.ts",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(message, JSON.stringify(data, null, 2));
}

function main() {
  const tzOffsetMin = new Date().getTimezoneOffset();
  log(
    "H-A: Browser/system timezone",
    { timezoneOffsetMinutes: tzOffsetMin, note: "UTC+5 ≈ -300" },
    "A",
  );

  // User selects Jul 1 – Jul 14 in date inputs
  const fromStr = "2026-07-01";
  const toStr = "2026-07-14";
  const parsed = dateRangeFromParamStrings(fromStr, toStr);

  log(
    "H-B: URL parsed as UTC calendar days",
    {
      fromStr,
      toStr,
      fromIso: parsed.from.toISOString(),
      toIso: parsed.to.toISOString(),
      fromDate: parsed.fromDate,
      toDate: parsed.toDate,
    },
    "B",
  );

  log(
    "H-C: Local format on UTC-boundary Date (display bug)",
    {
      compactLabel: formatCompactRangeLabel(parsed.from, parsed.to),
      fullLabel: formatRangeLabel(parsed.from, parsed.to),
      inputFrom: toInputValue(parsed.from),
      inputTo: toInputValue(parsed.to),
      expected: "Jul 1–14 / 2026-07-14",
    },
    "C",
  );

  log(
    "POST-FIX: String-based labels (expected Jul 1–14)",
    {
      compactLabel: formatCompactRangeLabelFromStrings(fromStr, toStr),
      inputFrom: fromStr,
      inputTo: toStr,
      reappliedTo: toStr,
    },
    "FIX",
  );

  // Re-apply without editing (user sees wrong date, clicks Apply)
  const reappliedTo = format(parsed.to, "yyyy-MM-dd");
  log(
    "H-D: Re-apply shifts filter +1 day",
    {
      reappliedToParam: reappliedTo,
      originalToParam: toStr,
      shiftsFilter: reappliedTo !== toStr,
    },
    "D",
  );

  // Manual pick end date 14 via picker input handler
  const draftTo = endOfDay(parseISO("2026-07-14"));
  const firstApplyTo = format(draftTo, "yyyy-MM-dd");
  log(
    "H-E: First apply after manual pick",
    {
      draftToIso: draftTo.toISOString(),
      firstApplyToParam: firstApplyTo,
      correctOnFirstApply: firstApplyTo === toStr,
    },
    "E",
  );
}

main();
