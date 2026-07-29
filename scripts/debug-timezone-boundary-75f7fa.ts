/**
 * Find orders whose local order_date is in range but order_date_day is not (timezone skew).
 * Run: npx tsx scripts/debug-timezone-boundary-75f7fa.ts [from] [to]
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
      runId: "post-fix",
      hypothesisId: "H4",
      location: "debug-timezone-boundary.ts",
      message,
      data,
      timestamp: Date.now(),
    })}\n`,
    "utf8",
  );
  console.log(message, data);
}

function localDay(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function utcDay(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
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
      .gte("order_date_day", "2026-06-28")
      .lte("order_date_day", "2026-07-18")
      .not("order_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
    offset += 1000;
  }

  const byOrder = new Map<number, { order_date: string | null; order_date_day: string | null }>();
  for (const row of rows) {
    if (!byOrder.has(row.order_id)) {
      byOrder.set(row.order_id, {
        order_date: row.order_date,
        order_date_day: row.order_date_day,
      });
    }
  }

  const localInRangeNotDay = new Set<number>();
  const dayInRangeNotLocal = new Set<number>();
  const localInRange = new Set<number>();
  const dayInRange = new Set<number>();

  for (const [orderId, order] of byOrder) {
    const local = localDay(order.order_date);
    const utc = utcDay(order.order_date);
    const dayCol = order.order_date_day;

    const localOk = local != null && inRange(local, fromDate, toDate);
    const dayOk = dayCol != null && inRange(dayCol, fromDate, toDate);

    if (localOk) localInRange.add(orderId);
    if (dayOk) dayInRange.add(orderId);
    if (localOk && !dayOk) localInRangeNotDay.add(orderId);
    if (dayOk && !localOk) dayInRangeNotLocal.add(orderId);
    if (localOk && dayCol && local !== dayCol && utc !== dayCol) {
      // track mismatch
    }
  }

  log("timezone boundary orders", {
    fromDate,
    toDate,
    distinctLocalInRange: localInRange.size,
    distinctOrderDateDayInRange: dayInRange.size,
    localInRangeButNotOrderDateDay: localInRangeNotDay.size,
    orderDateDayInRangeButNotLocal: dayInRangeNotLocal.size,
    sampleLocalNotDay: [...localInRangeNotDay].slice(0, 5),
    sampleDayNotLocal: [...dayInRangeNotLocal].slice(0, 5),
    excelExpected: 22922,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
