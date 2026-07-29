/**
 * Find orders in DB date range that portal pipeline drops.
 * Run: node scripts/diagnose-missing-orders.js [from] [to]
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) return;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    });
}

const fromDate = process.argv[2] || "2026-07-01";
const toDate = process.argv[3] || "2026-07-14";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function fetchAll() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id, order_number, order_date, order_date_day, country, bifurcation, status")
      .gte("order_date_day", fromDate)
      .lte("order_date_day", toDate)
      .not("order_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const rows = await fetchAll();
  const byOrder = new Map();
  for (const row of rows) {
    const id = row.order_id;
    const list = byOrder.get(id) ?? [];
    list.push(row);
    byOrder.set(id, list);
  }

  let allLinesMissingOrderDate = 0;
  let someLinesMissingOrderDate = 0;
  let unparseableOrderDate = 0;
  const sampleMissing = [];

  for (const [orderId, lines] of byOrder) {
    const parsed = lines.map((l) => parseDate(l.order_date));
    const anyParsed = parsed.some(Boolean);
    const allNull = parsed.every((d) => !d);
    const hasUnparseable = lines.some(
      (l) => l.order_date != null && l.order_date !== "" && !parseDate(l.order_date),
    );

    if (allNull) {
      allLinesMissingOrderDate++;
      if (sampleMissing.length < 5) {
        sampleMissing.push({
          orderId,
          order_date_day: lines[0].order_date_day,
          order_date: lines[0].order_date,
          lines: lines.length,
        });
      }
    } else if (parsed.some((d) => !d)) {
      someLinesMissingOrderDate++;
    }
    if (hasUnparseable) unparseableOrderDate++;
  }

  console.log(`Date range: ${fromDate} – ${toDate}`);
  console.log(`DB distinct orders:                    ${byOrder.size}`);
  console.log(`Orders where ALL lines lack order_date:  ${allLinesMissingOrderDate}`);
  console.log(`Orders where SOME lines lack order_date: ${someLinesMissingOrderDate}`);
  console.log(`Orders with unparseable order_date:     ${unparseableOrderDate}`);
  if (sampleMissing.length) {
    console.log("\nSample orders dropped by map (all lines null order_date):");
    for (const s of sampleMissing) console.log(" ", JSON.stringify(s));
  }

  // RPC facet filter: row must have country AND bifurcation
  const rpcRows = rows.filter(
    (r) =>
      r.country?.trim() &&
      r.bifurcation?.trim(),
  );
  const rpcOrderIds = new Set(rpcRows.map((r) => r.order_id));
  console.log(`\nRPC row-level facet lines:             ${rpcRows.length}`);
  console.log(`Distinct orders via RPC facet rows:    ${rpcOrderIds.size}`);

  // Orders lost only due to null order_date (have facet-qualified lines)
  let lostOnlyOrderDate = 0;
  for (const [orderId, lines] of byOrder) {
    const facetLines = lines.filter(
      (r) => r.country?.trim() && r.bifurcation?.trim(),
    );
    if (!facetLines.length) continue;
    const anyParsed = facetLines.some((l) => parseDate(l.order_date));
    if (!anyParsed) lostOnlyOrderDate++;
  }
  console.log(`Facet-ok orders lost (null order_date): ${lostOnlyOrderDate}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
