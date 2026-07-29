/**
 * Compare Total Orders vs Delivered vs status rollup; find Jul 15 gaps.
 * Run: npx tsx scripts/audit-kpi-counts.ts [from] [to]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const fromDate = process.argv[2] || "2026-07-01";
const toDate = process.argv[3] || "2026-07-15";
const METABASE_URL =
  process.env.METABASE_ORDERS_API_URL ||
  "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function fetchMetabaseRows() {
  const res = await fetch(METABASE_URL);
  if (!res.ok) throw new Error(`Metabase fetch failed: ${res.status}`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

function metabaseOrderDateLocalDay(row: Record<string, unknown>): string | null {
  const raw = row.Order_date as string | undefined;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const filters = {
    p_country: null,
    p_bifurcation: null,
    p_store_id: null,
    p_from_date: fromDate,
    p_to_date: toDate,
  };

  const { data: counts } = await sb.rpc("get_ops_orders_counts", filters);
  const { fetchOperationsStatusCounts } = await import("../src/lib/orders/operationsRollup");

  const statusCounts = await fetchOperationsStatusCounts({
    country: null,
    bifurcation: null,
    storeId: null,
    fromDate,
    toDate,
  });

  // Direct delivered count from line items
  const rows: Array<{ order_id: number; status: string | null; order_date_day: string | null }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("ops_orders_items")
      .select("order_id, status, order_date_day, country, bifurcation")
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

  const byOrder = new Map<number, { statuses: Set<string>; hasCountry: boolean; hasBifurcation: boolean }>();
  for (const row of rows) {
    const id = Number(row.order_id);
    const b = byOrder.get(id) ?? { statuses: new Set(), hasCountry: false, hasBifurcation: false };
    if (row.status?.trim()) b.statuses.add(row.status.trim());
    if (row.country?.trim()) b.hasCountry = true;
    if (row.bifurcation?.trim()) b.hasBifurcation = true;
    byOrder.set(id, b);
  }

  let directTotal = 0;
  let directDeliveredFirstLine = 0;
  let directDeliveredAnyLine = 0;
  let multiStatusOrders = 0;
  let deliveredButNotFirstLine = 0;

  for (const [, b] of byOrder) {
    if (!b.hasCountry || !b.hasBifurcation) continue;
    directTotal++;
    const statuses = [...b.statuses];
    if (statuses.length > 1) multiStatusOrders++;
    const first = statuses[0] ?? "Unknown";
    if (first === "Delivered") directDeliveredFirstLine++;
    if (b.statuses.has("Delivered")) {
      directDeliveredAnyLine++;
      if (first !== "Delivered") deliveredButNotFirstLine++;
    }
  }

  const metabase = await fetchMetabaseRows();
  const mbInRange = new Map<number, string>();
  for (const row of metabase) {
    const day = metabaseOrderDateLocalDay(row);
    if (!day || day < fromDate || day > toDate) continue;
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const status = String(row.status || "").trim();
    if (!mbInRange.has(id)) mbInRange.set(id, status);
    else if (status === "Delivered") mbInRange.set(id, status);
  }

  let mbDelivered = 0;
  for (const status of mbInRange.values()) {
    if (status === "Delivered") mbDelivered++;
  }

  const portalIds = new Set([...byOrder.keys()].filter((id) => {
    const b = byOrder.get(id)!;
    return b.hasCountry && b.hasBifurcation;
  }));

  const mbOnlyJul15: number[] = [];
  for (const [id] of mbInRange) {
    if (!portalIds.has(id)) mbOnlyJul15.push(id);
  }

  console.log({
    dateRange: `${fromDate} to ${toDate}`,
    rpcTotalOrders: (counts as { filteredCount: number }).filteredCount,
    rollupDelivered: statusCounts.deliveredOrders,
    rollupStatusSum: statusCounts.totalOrders,
    directDistinctOrderIds: directTotal,
    directDeliveredFirstStatus: directDeliveredFirstLine,
    directDeliveredAnyLineStatus: directDeliveredAnyLine,
    deliveredMissedByFirstLineRule: deliveredButNotFirstLine,
    multiStatusOrders,
    metabaseDistinctOrders: mbInRange.size,
    metabaseDelivered: mbDelivered,
    gapTotalVsMetabase: mbInRange.size - (counts as { filteredCount: number }).filteredCount,
    gapDeliveredVsMetabase: mbDelivered - statusCounts.deliveredOrders,
    gapDeliveredDirectAnyVsRollup: directDeliveredAnyLine - statusCounts.deliveredOrders,
    metabaseNotInPortal: mbOnlyJul15.length,
    sampleMetabaseOnly: mbOnlyJul15.slice(0, 15),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
