/**
 * List exact order_id sets: portal count vs Metabase — find gap IDs.
 * Run: npx tsx scripts/compare-order-id-sets-75f7fa.ts [from] [to]
 * Optional: --export portal-ids.txt metabase-ids.txt
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
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({
      sessionId: "75f7fa",
      runId: "id-set-compare",
      location: "compare-order-id-sets.ts",
      message,
      data,
      timestamp: Date.now(),
    })}\n`,
    "utf8",
  );
}

function localDay(raw: unknown): string | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inRange(day: string, from: string, to: string) {
  return day >= from && day <= to;
}

/** Portal logic: DISTINCT order_id passing get_ops_orders_counts filters. */
async function fetchPortalOrderIds(): Promise<Map<number, { order_date_day: string | null; country: string; bifurcation: string; lineCount: number }>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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

  const byOrder = new Map<number, { order_date_day: string | null; country: string; bifurcation: string; lineCount: number; hasCountry: boolean; hasBifurcation: boolean }>();

  for (const row of rows) {
    const id = Number(row.order_id);
    const bucket = byOrder.get(id) ?? {
      order_date_day: row.order_date_day,
      country: "",
      bifurcation: "",
      lineCount: 0,
      hasCountry: false,
      hasBifurcation: false,
    };
    bucket.lineCount++;
    if (row.country?.trim()) {
      bucket.hasCountry = true;
      bucket.country = row.country.trim();
    }
    if (row.bifurcation?.trim()) {
      bucket.hasBifurcation = true;
      bucket.bifurcation = row.bifurcation.trim();
    }
    byOrder.set(id, bucket);
  }

  const portalIds = new Map<number, { order_date_day: string | null; country: string; bifurcation: string; lineCount: number }>();
  for (const [id, b] of byOrder) {
    if (b.hasCountry && b.hasBifurcation) {
      portalIds.set(id, {
        order_date_day: b.order_date_day,
        country: b.country,
        bifurcation: b.bifurcation,
        lineCount: b.lineCount,
      });
    }
  }
  return portalIds;
}

/** Metabase: DISTINCT id where Order_date local day in range. */
async function fetchMetabaseOrderIds(): Promise<Map<number, { order_date: string; lineCount: number }>> {
  const res = await fetch(METABASE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Metabase fetch failed: ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>[];

  const byOrder = new Map<number, { order_date: string; lineCount: number }>();
  for (const row of raw) {
    const orderDateRaw = row.Order_date ?? row.order_date;
    const day = localDay(orderDateRaw);
    if (!day || !inRange(day, fromDate, toDate)) continue;

    const id = Number(row.id ?? row.order_id ?? 0);
    if (id <= 0) continue;

    const bucket = byOrder.get(id) ?? { order_date: String(orderDateRaw), lineCount: 0 };
    bucket.lineCount++;
    byOrder.set(id, bucket);
  }
  return byOrder;
}

async function main() {
  console.log(`\n=== Order ID set comparison: ${fromDate} to ${toDate} ===\n`);
  console.log("Portal counts: COUNT(DISTINCT order_id) — NOT sum of line row ids.\n");

  const [portalIds, metabaseIds] = await Promise.all([
    fetchPortalOrderIds(),
    fetchMetabaseOrderIds(),
  ]);

  const portalSet = new Set(portalIds.keys());
  const metabaseSet = new Set(metabaseIds.keys());

  const inPortalOnly = [...portalSet].filter((id) => !metabaseSet.has(id)).sort((a, b) => a - b);
  const inMetabaseOnly = [...metabaseSet].filter((id) => !portalSet.has(id)).sort((a, b) => a - b);
  const inBoth = [...portalSet].filter((id) => metabaseSet.has(id));

  const portalLineTotal = [...portalIds.values()].reduce((n, o) => n + o.lineCount, 0);

  const summary = {
    portalDistinctOrderIds: portalSet.size,
    portalLineRowsSummed: portalLineTotal,
    metabaseDistinctOrderIds: metabaseSet.size,
    inBoth: inBoth.length,
    inPortalOnly: inPortalOnly.length,
    inMetabaseOnly: inMetabaseOnly.length,
    excelExpected: 22922,
    gapExcelVsPortal: 22922 - portalSet.size,
    calculationNote:
      "Total Orders = count of unique order_id values, NOT sum(line ids). Multi-SKU orders count once.",
  };

  console.log("SUMMARY");
  console.log(JSON.stringify(summary, null, 2));

  log("order id set summary", summary);

  const samplePortalOnly = inPortalOnly.slice(0, 10).map((id) => ({
    order_id: id,
    ...portalIds.get(id),
  }));
  const sampleMetabaseOnly = inMetabaseOnly.slice(0, 10).map((id) => ({
    order_id: id,
    ...metabaseIds.get(id),
  }));

  console.log("\nSample order_ids in SUPABASE (portal) but NOT in Metabase sync JSON:");
  console.log(JSON.stringify(samplePortalOnly, null, 2));

  console.log("\nSample order_ids in METABASE but NOT in Supabase portal count:");
  console.log(JSON.stringify(sampleMetabaseOnly, null, 2));

  log("sample portal-only ids", { count: inPortalOnly.length, sample: samplePortalOnly });
  log("sample metabase-only ids", { count: inMetabaseOnly.length, sample: sampleMetabaseOnly });

  // Export full ID lists for user investigation
  const outDir = path.join(process.cwd(), "scripts", "order-id-exports");
  fs.mkdirSync(outDir, { recursive: true });
  const portalPath = path.join(outDir, `portal-order-ids_${fromDate}_${toDate}.txt`);
  const metabasePath = path.join(outDir, `metabase-order-ids_${fromDate}_${toDate}.txt`);
  const portalOnlyPath = path.join(outDir, `portal-only-ids_${fromDate}_${toDate}.txt`);
  const metabaseOnlyPath = path.join(outDir, `metabase-only-ids_${fromDate}_${toDate}.txt`);

  fs.writeFileSync(portalPath, [...portalSet].sort((a, b) => a - b).join("\n"), "utf8");
  fs.writeFileSync(metabasePath, [...metabaseSet].sort((a, b) => a - b).join("\n"), "utf8");
  fs.writeFileSync(portalOnlyPath, inPortalOnly.join("\n"), "utf8");
  fs.writeFileSync(metabaseOnlyPath, inMetabaseOnly.join("\n"), "utf8");

  console.log("\nExported ID lists:");
  console.log(`  Portal (all ${portalSet.size}):     ${portalPath}`);
  console.log(`  Metabase (all ${metabaseSet.size}):  ${metabasePath}`);
  console.log(`  Portal only (${inPortalOnly.length}):       ${portalOnlyPath}`);
  console.log(`  Metabase only (${inMetabaseOnly.length}):     ${metabaseOnlyPath}`);

  log("exported files", {
    portalPath,
    metabasePath,
    portalOnlyPath,
    metabaseOnlyPath,
  });

  // Example: show one multi-line order
  const multiLine = [...portalIds.entries()].find(([, v]) => v.lineCount > 1);
  if (multiLine) {
    const example = {
      order_id: multiLine[0],
      lineCount: multiLine[1].lineCount,
      countsAsOrders: 1,
      note: "This order has multiple SKU lines but counts as 1 in Total Orders",
    };
    console.log("\nExample multi-SKU order (counts as 1, not lineCount):");
    console.log(JSON.stringify(example, null, 2));
    log("multi-sku example", example);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
