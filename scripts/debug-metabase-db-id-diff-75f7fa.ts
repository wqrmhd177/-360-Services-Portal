/**
 * Compare Metabase order IDs vs Supabase for a date range.
 * Run: npx tsx scripts/debug-metabase-db-id-diff-75f7fa.ts [from] [to]
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
const METABASE_URL =
  process.env.METABASE_ORDERS_API_URL ||
  "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json";

function log(message: string, data: Record<string, unknown>) {
  const entry = {
    sessionId: "75f7fa",
    runId: "post-fix",
    hypothesisId: "H1",
    location: "debug-metabase-db-id-diff.ts",
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

function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

async function fetchDbOrderIds(): Promise<Set<number>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const ids = new Set<number>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id")
      .gte("order_date_day", fromDate)
      .lte("order_date_day", toDate)
      .not("order_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const id = Number(row.order_id);
      if (id > 0) ids.add(id);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return ids;
}

async function main() {
  const res = await fetch(METABASE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Metabase fetch failed: ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>[];

  const idsUtc = new Set<number>();
  const idsLocal = new Set<number>();

  for (const row of raw) {
    const orderDate = parseOrderDate(row.Order_date ?? row.order_date);
    if (!orderDate) continue;
    const id = Number(row.id ?? row.order_id ?? 0);
    if (id <= 0) continue;
    if (inRange(utcDay(orderDate), fromDate, toDate)) idsUtc.add(id);
    if (inRange(localDay(orderDate), fromDate, toDate)) idsLocal.add(id);
  }

  const dbIds = await fetchDbOrderIds();

  const inMetabaseNotDbUtc = [...idsUtc].filter((id) => !dbIds.has(id));
  const inDbNotMetabaseUtc = [...dbIds].filter((id) => !idsUtc.has(id));
  const inMetabaseNotDbLocal = [...idsLocal].filter((id) => !dbIds.has(id));
  const inDbNotMetabaseLocal = [...dbIds].filter((id) => !idsLocal.has(id));

  log("metabase vs db order id diff", {
    fromDate,
    toDate,
    metabaseUtc: idsUtc.size,
    metabaseLocal: idsLocal.size,
    dbOrderDateDay: dbIds.size,
    inMetabaseNotDbUtc: inMetabaseNotDbUtc.length,
    inDbNotMetabaseUtc: inDbNotMetabaseUtc.length,
    inMetabaseNotDbLocal: inMetabaseNotDbLocal.length,
    inDbNotMetabaseLocal: inDbNotMetabaseLocal.length,
    sampleMetabaseNotDb: inMetabaseNotDbUtc.slice(0, 5),
    sampleDbNotMetabase: inDbNotMetabaseUtc.slice(0, 5),
    excelExpected: 22922,
    excelGapVsDb: 22922 - dbIds.size,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
