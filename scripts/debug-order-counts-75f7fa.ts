/**
 * Debug session 75f7fa — compare portal counts vs DB diagnostics.
 * Run: npx tsx scripts/debug-order-counts-75f7fa.ts [from] [to]
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
const toDate = process.argv[3] || "2026-07-14";

function log(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  const entry = {
    sessionId: "75f7fa",
    runId: "pre-fix",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`, "utf8");
  console.log(message, data);
}

async function main() {
  const { fetchOrderCounts, fetchOrderCountDiagnostics } = await import(
    "../src/lib/orders/filteredItems"
  );
  const { fetchOperationsStatusCounts } = await import("../src/lib/orders/operationsRollup");

  const filters = {
    country: null,
    bifurcation: null,
    storeId: null,
    fromDate,
    toDate,
  };

  log("H4", "debug-order-counts.ts", "date range", { fromDate, toDate });

  const [counts, statusCounts, diagnostics] = await Promise.all([
    fetchOrderCounts(filters),
    fetchOperationsStatusCounts(filters),
    fetchOrderCountDiagnostics(filters),
  ]);

  log("H2-H3", "debug-order-counts.ts", "RPC counts", counts);
  log("H3-H5", "debug-order-counts.ts", "status rollup KPI", {
    totalOrders: statusCounts.totalOrders,
    deliveredOrders: statusCounts.deliveredOrders,
    rollupVsRpcDelta: statusCounts.totalOrders - counts.filteredCount,
  });
  log("H1-H2", "debug-order-counts.ts", "DB diagnostics", {
    ...diagnostics,
    excludedByFacet: diagnostics.distinctInRange - diagnostics.distinctRpcFacet,
    excelExpected: 22922,
    gapVsExcelRollup: 22922 - statusCounts.totalOrders,
    gapVsExcelRpc: 22922 - counts.filteredCount,
    gapVsExcelRawDb: 22922 - diagnostics.distinctInRange,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
