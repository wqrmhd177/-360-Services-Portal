/**
 * Compare DB counts by order_date_day vs local order_date calendar day.
 * Run: npx tsx scripts/debug-order-date-filter-75f7fa.ts [from] [to]
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
      location: "debug-order-date-filter.ts",
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    country: string | null;
    bifurcation: string | null;
  }> = [];

  // Wider pull to catch boundary orders
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id, order_date, order_date_day, country, bifurcation")
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

  const byOrderDateDay = new Set<number>();
  const byLocalOrderDate = new Set<number>();
  const byLocalWithFacet = new Set<number>();

  for (const row of rows) {
    const id = Number(row.order_id);
    if (!id) continue;
    if (row.order_date_day && inRange(row.order_date_day, fromDate, toDate)) {
      byOrderDateDay.add(id);
    }
    const local = localDay(row.order_date);
    if (local && inRange(local, fromDate, toDate)) {
      byLocalOrderDate.add(id);
      if (row.country?.trim() && row.bifurcation?.trim()) {
        byLocalWithFacet.add(id);
      }
    }
  }

  log("db count by date column", {
    fromDate,
    toDate,
    byOrderDateDay: byOrderDateDay.size,
    byLocalOrderDate: byLocalOrderDate.size,
    byLocalWithFacet: byLocalWithFacet.size,
    excelExpected: 22922,
    gapExcelVsOrderDateDay: 22922 - byOrderDateDay.size,
    gapExcelVsLocal: 22922 - byLocalOrderDate.size,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
