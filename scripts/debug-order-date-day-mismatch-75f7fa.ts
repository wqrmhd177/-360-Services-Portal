/**
 * Find orders where order_date calendar day differs from order_date_day column.
 * Run: npx tsx scripts/debug-order-date-day-mismatch-75f7fa.ts [from] [to]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1].trim()] = val;
  }
}

const LOG = path.join(process.cwd(), "debug-75f7fa.log");
const fromDate = process.argv[2] || "2026-07-01";
const toDate = process.argv[3] || "2026-07-15";

function log(message: string, data: Record<string, unknown>) {
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({
      sessionId: "75f7fa",
      runId: "pre-fix",
      hypothesisId: "H4-H5",
      location: "debug-order-date-day-mismatch.ts",
      message,
      data,
      timestamp: Date.now(),
    })}\n`,
    "utf8",
  );
  console.log(message, data);
}

function orderDateDayFromRaw(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const rows: Array<{
    order_id: number;
    order_date: string | null;
    order_date_day: string | null;
  }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id, order_date, order_date_day")
      .gte("order_date_day", fromDate)
      .lte("order_date_day", toDate)
      .not("order_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
    offset += 1000;
  }

  const byOrder = new Map<number, { order_date_day: string | null; order_date: string | null }>();
  for (const row of rows) {
    if (!byOrder.has(row.order_id)) {
      byOrder.set(row.order_id, {
        order_date_day: row.order_date_day,
        order_date: row.order_date,
      });
    }
  }

  let mismatchOrders = 0;
  let inRangeByOrderDate = 0;
  let outRangeByOrderDate = 0;

  for (const [, order] of byOrder) {
    const derived = orderDateDayFromRaw(order.order_date);
    const stored = order.order_date_day;
    if (derived && stored && derived !== stored) mismatchOrders++;
    if (derived && derived >= fromDate && derived <= toDate) inRangeByOrderDate++;
    else if (derived) outRangeByOrderDate++;
  }

  log("order_date vs order_date_day", {
    fromDate,
    toDate,
    distinctByOrderDateDay: byOrder.size,
    mismatchOrders,
    inRangeByOrderDate,
    outRangeByOrderDate,
    excelExpected: 22922,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
