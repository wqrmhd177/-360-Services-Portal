/**
 * Find orders where Metabase status=Delivered but portal DB status differs (same order_date filter).
 * Run: npx tsx scripts/diff-delivered-status.ts [from] [to]
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
const toDate = process.argv[3] || "2026-07-14";
const METABASE_URL =
  process.env.METABASE_ORDERS_API_URL ||
  "https://zambeel.metabaseapp.com/public/question/96450ced-a27c-47c9-b9cd-58fe804a7889.json";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function metabaseLocalDay(raw: string): string {
  const d = new Date(raw);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function metabaseUtcDay(raw: string): string {
  const d = new Date(raw);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const res = await fetch(METABASE_URL);
  const metabase = (await res.json()) as Array<Record<string, unknown>>;

  const mbByOrder = new Map<number, { status: string; localDay: string; utcDay: string }>();
  for (const row of metabase) {
    const id = Number(row.id);
    const od = String(row.Order_date || "");
    if (!id || !od) continue;
    const localDay = metabaseLocalDay(od);
    const utcDay = metabaseUtcDay(od);
    const status = String(row.status || "").trim();
    const existing = mbByOrder.get(id);
    if (!existing) {
      mbByOrder.set(id, { status, localDay, utcDay });
    } else if (status === "Delivered") {
      mbByOrder.set(id, { status, localDay, utcDay });
    }
  }

  const rows: Array<{
    order_id: number;
    status: string | null;
    order_date_day: string | null;
    delivered_date: string | null;
    country: string | null;
    bifurcation: string | null;
  }> = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("ops_orders_items")
      .select("order_id, status, order_date_day, delivered_date, country, bifurcation")
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

  const portalByOrder = new Map<
    number,
    { status: string; order_date_day: string; delivered_date: string | null; hasCountry: boolean; hasBifurcation: boolean }
  >();
  for (const row of rows) {
    const id = Number(row.order_id);
    const b = portalByOrder.get(id) ?? {
      status: row.status?.trim() || "Unknown",
      order_date_day: row.order_date_day!,
      delivered_date: row.delivered_date,
      hasCountry: false,
      hasBifurcation: false,
    };
    if (row.country?.trim()) b.hasCountry = true;
    if (row.bifurcation?.trim()) b.hasBifurcation = true;
    portalByOrder.set(id, b);
  }

  const mbDeliveredNotPortal: Array<Record<string, unknown>> = [];
  const portalDeliveredNotMb: Array<Record<string, unknown>> = [];

  for (const [id, portal] of portalByOrder) {
    if (!portal.hasCountry || !portal.hasBifurcation) continue;
    const mb = mbByOrder.get(id);
    if (!mb) continue;

    const inMbLocal = mb.localDay >= fromDate && mb.localDay <= toDate;
    const inMbUtc = mb.utcDay >= fromDate && mb.utcDay <= toDate;

    if (mb.status === "Delivered" && portal.status !== "Delivered") {
      mbDeliveredNotPortal.push({
        order_id: id,
        portalStatus: portal.status,
        metabaseStatus: mb.status,
        portalOrderDateDay: portal.order_date_day,
        metabaseLocalDay: mb.localDay,
        metabaseUtcDay: mb.utcDay,
        portalDeliveredDate: portal.delivered_date,
        inMbLocalRange: inMbLocal,
        inMbUtcRange: inMbUtc,
      });
    }
    if (portal.status === "Delivered" && mb.status !== "Delivered") {
      portalDeliveredNotMb.push({
        order_id: id,
        portalStatus: portal.status,
        metabaseStatus: mb.status,
        portalOrderDateDay: portal.order_date_day,
        metabaseLocalDay: mb.localDay,
        metabaseUtcDay: mb.utcDay,
      });
    }
  }

  let mbDeliveredInPortalRange = 0;
  for (const [id, mb] of mbByOrder) {
    if (mb.localDay < fromDate || mb.localDay > toDate) continue;
    if (mb.status !== "Delivered") continue;
    const portal = portalByOrder.get(id);
    if (portal?.hasCountry && portal?.hasBifurcation) mbDeliveredInPortalRange++;
  }

  console.log({
    dateRange: `${fromDate} to ${toDate}`,
    note: "Portal filters by order_date_day on ORDER DATE, not delivered_date",
    portalDelivered: [...portalByOrder.values()].filter(
      (p) => p.hasCountry && p.hasBifurcation && p.status === "Delivered",
    ).length,
    metabaseDeliveredLocalDay: mbDeliveredInPortalRange,
    metabaseDeliveredButPortalOtherStatus: mbDeliveredNotPortal.length,
    portalDeliveredButMetabaseOtherStatus: portalDeliveredNotMb.length,
    samplesMbDeliveredNotPortal: mbDeliveredNotPortal.slice(0, 10),
    samplesPortalDeliveredNotMb: portalDeliveredNotMb.slice(0, 10),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
