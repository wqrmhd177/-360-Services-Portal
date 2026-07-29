/**
 * Compare Metabase distinct order count vs Supabase for date range.
 * Run: npx tsx scripts/debug-metabase-order-count-75f7fa.ts [from] [to]
 */
import fs from "fs";
import path from "path";

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
const METABASE_URL =
  process.env.METABASE_ORDERS_API_URL ||
  "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json";

function log(hypothesisId: string, message: string, data: Record<string, unknown>) {
  const entry = {
    sessionId: "75f7fa",
    runId: "pre-fix",
    hypothesisId,
    location: "debug-metabase-order-count.ts",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(message, data);
}

function parseOrderDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(d: Date, from: string, to: string): boolean {
  const day = d.toISOString().slice(0, 10);
  return day >= from && day <= to;
}

async function main() {
  const res = await fetch(METABASE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Metabase fetch failed: ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>[];

  const ids = new Set<number>();
  let linesInRange = 0;
  let linesNoDate = 0;

  for (const row of raw) {
    const orderDate = parseOrderDate(row.Order_date ?? row.order_date);
    if (!orderDate) {
      linesNoDate++;
      continue;
    }
    if (!inRange(orderDate, fromDate, toDate)) continue;
    linesInRange++;
    const id = Number(row.id ?? row.order_id ?? 0);
    if (id > 0) ids.add(id);
  }

  log("H1", "metabase distinct orders in range", {
    fromDate,
    toDate,
    metabaseDistinctOrders: ids.size,
    linesInRange,
    linesNoDate,
    excelExpected: 22922,
    gapVsExcel: 22922 - ids.size,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
