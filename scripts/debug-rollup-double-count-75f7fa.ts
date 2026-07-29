/**
 * Find orders double-counted when summing status rollup order_count.
 * Run: npx tsx scripts/debug-rollup-double-count-75f7fa.ts [from] [to]
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

function log(message: string, data: Record<string, unknown>) {
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({
      sessionId: "75f7fa",
      runId: "pre-fix",
      hypothesisId: "H3",
      location: "debug-rollup-double-count.ts",
      message,
      data,
      timestamp: Date.now(),
    })}\n`,
    "utf8",
  );
  console.log(message, data);
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  type Row = {
    order_date_day: string;
    country: string;
    bifurcation: string;
    store_id: number;
    status: string;
    order_count: number;
  };

  const rows: Row[] = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from("ops_orders_status_rollup")
      .select("order_date_day, country, bifurcation, store_id, status, order_count")
      .gte("order_date_day", fromDate)
      .lte("order_date_day", toDate)
      .neq("country", "Unknown")
      .neq("country", "")
      .neq("bifurcation", "")
      .order("order_date_day", { ascending: true })
      .order("country", { ascending: true })
      .order("bifurcation", { ascending: true })
      .order("store_id", { ascending: true })
      .order("status", { ascending: true })
      .range(offset, offset + 999);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
    offset += 1000;
  }

  const sumRollup = rows.reduce((n, r) => n + Number(r.order_count ?? 0), 0);

  // Reconstruct which orders appear in multiple buckets using raw line items
  const lineRows: Array<{
    order_id: number;
    order_date_day: string | null;
    country: string | null;
    bifurcation: string | null;
    store_id: number | null;
    status: string | null;
  }> = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id, order_date_day, country, bifurcation, store_id, status")
      .gte("order_date_day", fromDate)
      .lte("order_date_day", toDate)
      .not("order_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    lineRows.push(...(data as typeof lineRows));
    if (data.length < 1000) break;
    offset += 1000;
  }

  const bucketKeysByOrder = new Map<number, Set<string>>();
  const statusByOrder = new Map<number, Set<string>>();
  for (const row of lineRows) {
    const key = [
      row.order_date_day,
      row.country?.trim() || "Unknown",
      row.bifurcation?.trim() || "",
      row.store_id ?? 0,
      row.status?.trim() || "Unknown",
    ].join("|");
    const buckets = bucketKeysByOrder.get(row.order_id) ?? new Set<string>();
    buckets.add(key);
    bucketKeysByOrder.set(row.order_id, buckets);

    const statuses = statusByOrder.get(row.order_id) ?? new Set<string>();
    statuses.add(row.status?.trim() || "Unknown");
    statusByOrder.set(row.order_id, statuses);
  }

  let multiBucketOrders = 0;
  let multiStatusOrders = 0;
  for (const [orderId, buckets] of bucketKeysByOrder) {
    if (buckets.size > 1) multiBucketOrders++;
    if ((statusByOrder.get(orderId)?.size ?? 0) > 1) multiStatusOrders++;
  }

  log("rollup double count analysis", {
    fromDate,
    toDate,
    rollupRowCount: rows.length,
    sumRollupOrderCount: sumRollup,
    distinctOrdersInDb: bucketKeysByOrder.size,
    overcountDelta: sumRollup - bucketKeysByOrder.size,
    multiBucketOrders,
    multiStatusOrders,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
