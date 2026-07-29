/** Run: npx tsx scripts/debug-dubai-date-count-75f7fa.ts [from] [to] */
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

const fromDate = process.argv[2] || "2026-07-01";
const toDate = process.argv[3] || "2026-07-15";
const LOG = path.join(process.cwd(), "debug-75f7fa.log");

const dubaiDay = (raw: string | null) => {
  if (!raw) return null;
  return new Date(raw).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
};

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const rows: Array<{ order_id: number; order_date: string | null; order_date_day: string | null }> =
    [];
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
    if (!byOrder.has(row.order_id)) byOrder.set(row.order_id, row);
  }

  let dubaiIn = 0;
  let dayIn = 0;
  for (const order of byOrder.values()) {
    const d = dubaiDay(order.order_date);
    if (d && d >= fromDate && d <= toDate) dubaiIn++;
    if (order.order_date_day && order.order_date_day >= fromDate && order.order_date_day <= toDate) {
      dayIn++;
    }
  }

  const entry = {
    sessionId: "75f7fa",
    runId: "post-fix",
    hypothesisId: "H4",
    location: "debug-dubai-date-count.ts",
    message: "dubai vs order_date_day counts",
    data: { fromDate, toDate, dubaiIn, dayIn, excelExpected: 22922, gapExcelVsDubai: 22922 - dubaiIn },
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(entry.data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
