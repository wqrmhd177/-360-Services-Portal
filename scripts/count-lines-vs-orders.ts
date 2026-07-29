import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { count: lineRows } = await sb
    .from("ops_orders_items")
    .select("*", { count: "exact", head: true })
    .gte("order_date_day", "2026-07-01")
    .lte("order_date_day", "2026-07-15")
    .not("order_id", "is", null);

  const portalIds = fs
    .readFileSync(
      path.join(process.cwd(), "scripts/order-id-exports/portal-order-ids_2026-07-01_2026-07-15.txt"),
      "utf8",
    )
    .split(/\r?\n/)
    .filter(Boolean);

  console.log({
    distinctOrderIds: portalIds.length,
    lineRowsInSameDateRange: lineRows,
    extraLinesFromMultiSkuOrders: (lineRows ?? 0) - portalIds.length,
    sampleOrderIds: portalIds.slice(0, 5),
    sampleOrderIdsEnd: portalIds.slice(-5),
  });
}

main();
