import { defaultDateRange, toInputValue } from "@/lib/date-range-presets";

export function defaultOrdersSearchParams(): Record<string, string> {
  const { from, to } = defaultDateRange();
  return {
    from: toInputValue(from),
    to: toInputValue(to),
  };
}
