/**
 * Explain exactly how portal Total Orders is calculated vs alternatives.
 * Run: npx tsx scripts/explain-total-orders-calc-75f7fa.ts [from] [to]
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
  const entry = {
    sessionId: "75f7fa",
    runId: "explain-calc",
    location: "explain-total-orders-calc.ts",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(`\n${message}`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const filters = {
    country: null,
    bifurcation: null,
    storeId: null,
    fromDate,
    toDate,
  };

  const { fetchOrderCounts } = await import("../src/lib/orders/filteredItems");
  const { fetchOperationsStatusCounts } = await import("../src/lib/orders/operationsRollup");

  const [rpcCounts, statusRollup] = await Promise.all([
    fetchOrderCounts(filters),
    fetchOperationsStatusCounts(filters),
  ]);

  const portalTotalOrders = rpcCounts.filteredCount;

  log("STEP 1 — Portal Total Orders source", {
    formula: "COUNT(DISTINCT order_id) via get_ops_orders_counts RPC → filteredCount",
    portalTotalOrders,
    note: "dbAnalytics.ts overrides status rollup sum with this value for the KPI card",
  });

  const { data: rpcRaw } = await supabase.rpc("get_ops_orders_counts", {
    p_country: null,
    p_bifurcation: null,
    p_store_id: null,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  log("STEP 2 — RPC raw response", rpcRaw as Record<string, unknown>);

  log("STEP 3 — Status rollup sum (old method, NOT used for Total Orders KPI)", {
    statusRollupSum: statusRollup.totalOrders,
    deltaVsPortalTotal: statusRollup.totalOrders - portalTotalOrders,
    note: "Previously showed 22801 due to double-counting; now matches after per-order MV patch",
  });

  // Break down filter rules
  const rows: Array<{
    order_id: number;
    order_date_day: string | null;
    country: string | null;
    bifurcation: string | null;
  }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ops_orders_items")
      .select("order_id, order_date_day, country, bifurcation")
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

  const byOrder = new Map<number, { hasCountry: boolean; hasBifurcation: boolean }>();
  for (const row of rows) {
    const id = Number(row.order_id);
    const b = byOrder.get(id) ?? { hasCountry: false, hasBifurcation: false };
    if (row.country?.trim()) b.hasCountry = true;
    if (row.bifurcation?.trim()) b.hasBifurcation = true;
    byOrder.set(id, b);
  }

  let passDateOnly = byOrder.size;
  let passWithCountryBifurcation = 0;
  let failMissingCountry = 0;
  let failMissingBifurcation = 0;

  for (const b of byOrder.values()) {
    if (b.hasCountry && b.hasBifurcation) passWithCountryBifurcation++;
    if (!b.hasCountry) failMissingCountry++;
    if (!b.hasBifurcation) failMissingBifurcation++;
  }

  log("STEP 4 — Filter breakdown (why orders included/excluded)", {
    dateRange: `${fromDate} to ${toDate}`,
    dateColumn: "order_date_day (UTC date from sync, NOT Order_date timezone)",
    distinctOrdersInDateRange: passDateOnly,
    passPortalFilters: passWithCountryBifurcation,
    excludedMissingCountry: failMissingCountry,
    excludedMissingBifurcation: failMissingBifurcation,
    portalLogic: [
      "order_id IS NOT NULL",
      "order_date_day >= from AND order_date_day <= to",
      "When Country=All: country must be non-null and non-empty on at least one line",
      "When Bifurcation=All: bifurcation must be non-null and non-empty on at least one line",
      "Count DISTINCT order_id (one order with multiple SKUs = 1 order)",
    ],
  });

  log("STEP 5 — Comparison", {
    portalTotalOrders,
    distinctInDateRangeOnly: passDateOnly,
    excludedByCountryBifurcationRule: passDateOnly - passWithCountryBifurcation,
    excelReported: 22922,
    gapVsExcel: 22922 - portalTotalOrders,
    likelyExcelDifference:
      "Excel may use Order_date with report timezone, different Metabase question, or count at export time with more rows",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
