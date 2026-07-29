/**
 * Compare DB counts vs portal analytics pipeline for a date range.
 * Run: node scripts/diagnose-portal-counts.js [from] [to]
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
  const { fetchOperationsStatusCounts } = await import(
    "../src/lib/orders/operationsRollup.ts"
  );

  const filters = {
    country: null,
    bifurcation: null,
    storeId: null,
    fromDate,
    toDate,
  };

  const counts = await fetchOperationsStatusCounts(filters);

  console.log(`Date range: ${fromDate} – ${toDate}`);
  console.log(`Total Orders KPI (rollup):     ${counts.totalOrders}`);
  console.log(`Delivered Orders KPI (rollup): ${counts.deliveredOrders}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
