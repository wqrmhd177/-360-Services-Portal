/**
 * Compare line-row counts vs distinct order_id vs distinct order_number for a date range.
 * Run: node scripts/validate-order-counts.js [from] [to]
 * Example: node scripts/validate-order-counts.js 2026-07-01 2026-07-08
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/\r$/, "");
  });
}

const fromDate = process.argv[2] || "2026-07-01";
const toDate = process.argv[3] || "2026-07-08";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

function hasCountry(row) {
  return Boolean(row.country?.trim());
}

function hasBifurcation(row) {
  return Boolean(row.bifurcation?.trim());
}

function orderKey(row) {
  return `id:${row.order_id ?? 0}`;
}

async function main() {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id, order_number, country, bifurcation, order_date_day")
      .gte("order_date_day", fromDate)
      .lte("order_date_day", toDate)
      .order("id", { ascending: true })
      .range(offset, offset + 999);

    if (error) {
      console.error("Query failed:", error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const orderIds = new Set(rows.map((r) => r.order_id).filter((id) => id != null));
  const orderNumbers = new Set(
    rows.map((r) => r.order_number?.trim()).filter(Boolean),
  );
  const groupKeys = new Set(rows.map(orderKey));

  const byOrder = new Map();
  for (const row of rows) {
    const key = orderKey(row);
    const list = byOrder.get(key) ?? [];
    list.push(row);
    byOrder.set(key, list);
  }

  let allFacets = 0;
  let withCountryOnly = 0;
  let withBifurcationOnly = 0;
  for (const [, lines] of byOrder) {
    const countryOk = lines.some(hasCountry);
    const bifOk = lines.some(hasBifurcation);
    if (countryOk && bifOk) allFacets++;
    if (countryOk) withCountryOnly++;
    if (bifOk) withBifurcationOnly++;
  }

  console.log(`Date range: ${fromDate} – ${toDate}`);
  console.log(`Line rows:                         ${rows.length}`);
  console.log(`DISTINCT Metabase id (order_id):     ${orderIds.size}`);
  console.log(`Unique group keys (Metabase id):     ${groupKeys.size}`);
  console.log(`(order_number is seller-facing, not used for counts)`);
  console.log(`Orders w/ country + bifurcation (All/All): ${allFacets}`);
  console.log(`Orders w/ any country:        ${withCountryOnly}`);
  console.log(`Orders w/ any bifurcation:    ${withBifurcationOnly}`);

  const bifurcations = [...new Set(rows.map((r) => r.bifurcation?.trim()).filter(Boolean))].sort();
  console.log("\nPer bifurcation (unique order_number):");
  for (const b of bifurcations.slice(0, 12)) {
    const nums = new Set();
    for (const row of rows) {
      if (row.bifurcation?.trim() === b && row.order_number?.trim()) {
        nums.add(row.order_number.trim());
      }
    }
    console.log(`  ${b}: ${nums.size}`);
  }
  if (bifurcations.length > 12) {
    console.log(`  … and ${bifurcations.length - 12} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
