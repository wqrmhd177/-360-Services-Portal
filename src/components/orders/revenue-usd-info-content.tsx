import {
  REVENUE_USD_INFO_BODY,
  REVENUE_USD_INFO_HEADING,
} from "@/lib/order-currency/messages";

/** Full copy for ℹ popover — matches page summary text */
export function RevenueUsdInfoContent() {
  return (
    <>
      <p className="font-medium text-[var(--foreground)]">{REVENUE_USD_INFO_HEADING}</p>
      <p className="mt-2">{REVENUE_USD_INFO_BODY}</p>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Env:{" "}
        <code className="rounded bg-[var(--table-row-hover)] px-1.5 py-0.5 font-mono text-[var(--foreground)]">
          EXCHANGE_RATES_TO_USD_JSON
        </code>
      </p>
    </>
  );
}

export { REVENUE_USD_INFO_HEADING, REVENUE_USD_INFO_BODY };
