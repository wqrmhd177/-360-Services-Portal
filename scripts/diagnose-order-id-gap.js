/**
 * Compare order_id sets: direct table vs RPC vs mapped portal items.
 * Run: npx tsx scripts/diagnose-order-id-gap.js [from] [to]
 */
const fs = require("fs");
const path = require("path");

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

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { fetchFilteredOrderLineItems, mapEnrichedDbRowToOrderLineItem } =
    await import("../src/lib/orders/filteredItems.ts");
  const { getOrderGroupKey } = await import("../src/lib/analytics/orders.ts");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const directRows = [];
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
    directRows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const rpcRows = [];
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .rpc("get_ops_orders_filtered_enriched", {
        p_country: null,
        p_bifurcation: null,
        p_store_id: null,
        p_from_date: fromDate,
        p_to_date: toDate,
      })
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    rpcRows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const items = await fetchFilteredOrderLineItems({
    country: null,
    bifurcation: null,
    storeId: null,
    fromDate,
    toDate,
  });

  const directIds = new Set(directRows.map((r) => r.order_id));
  const rpcIds = new Set(rpcRows.map((r) => r.order_id));
  const portalIds = new Set(items.map((i) => i.metabaseId));
  const portalKeys = new Set(items.map((i) => getOrderGroupKey(i)));

  const mappedFromRpc = rpcRows
    .map(mapEnrichedDbRowToOrderLineItem)
    .filter(Boolean);
  const mappedIds = new Set(mappedFromRpc.map((i) => i.metabaseId));

  const missingInRpc = [...directIds].filter((id) => !rpcIds.has(id));
  const missingInPortal = [...rpcIds].filter((id) => !portalIds.has(id));
  const missingInMapped = [...rpcIds].filter((id) => !mappedIds.has(id));

  console.log(`Date range: ${fromDate} – ${toDate}`);
  console.log(`Direct rows / orders:  ${directRows.length} / ${directIds.size}`);
  console.log(`RPC rows / orders:     ${rpcRows.length} / ${rpcIds.size}`);
  console.log(`Mapped from RPC:       ${mappedFromRpc.length} / ${mappedIds.size}`);
  console.log(`Portal items / orders: ${items.length} / ${portalIds.size}`);
  console.log(`Portal group keys:     ${portalKeys.size}`);
  console.log(`Missing in RPC:        ${missingInRpc.length}`);
  console.log(`Missing after map:     ${missingInMapped.length}`);
  console.log(`Missing in portal:     ${missingInPortal.length}`);

  if (missingInMapped.length) {
    console.log("\nSample orders in RPC but dropped by map:");
    for (const id of missingInMapped.slice(0, 5)) {
      const lines = rpcRows.filter((r) => r.order_id === id);
      console.log(
        " ",
        id,
        "lines:",
        lines.length,
        "order_date samples:",
        lines.slice(0, 2).map((l) => l.order_date),
      );
    }
  }

  if (missingInRpc.length) {
    console.log("\nSample orders in direct but not RPC:");
    for (const id of missingInRpc.slice(0, 5)) {
      const lines = directRows.filter((r) => r.order_id === id);
      console.log(
        " ",
        id,
        "country:",
        lines[0]?.country,
        "bifurcation:",
        lines[0]?.bifurcation,
      );
    }
  }

  // Check duplicate metabaseId=0
  const zeroIds = items.filter((i) => i.metabaseId === 0).length;
  console.log(`\nPortal items with metabaseId=0: ${zeroIds}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
