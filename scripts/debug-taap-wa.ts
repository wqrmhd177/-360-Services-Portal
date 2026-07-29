import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const text = readFileSync(resolve(".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const sku = "TAAP-N-GF-ZAM";
  const country = "United Arab Emirates";
  const bifurcation = "Dropshipper";
  const from = "2026-07-20";
  const to = "2026-07-26";
  const storeId = 16858;

  const { data: rows, error } = await supabase
    .from("ops_sku_daily_performance")
    .select(
      "order_date_day_pst, store_id, store_name, approved_quantity, dispatched_quantity, delivered_quantity",
    )
    .eq("sku", sku)
    .eq("country", country)
    .eq("bifurcation", bifurcation)
    .eq("store_id", storeId)
    .gte("order_date_day_pst", from)
    .lte("order_date_day_pst", to)
    .order("order_date_day_pst");

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Daily rows for store ${storeId} (${sku}, ${country}, ${bifurcation}, ${from} to ${to}):\n`);
  let sumApproved = 0;
  let sumDispatched = 0;
  let activeDispatchDays = 0;

  for (const r of rows ?? []) {
    const approved = Number(r.approved_quantity) || 0;
    const dispatched = Number(r.dispatched_quantity) || 0;
    sumApproved += approved;
    sumDispatched += dispatched;
    if (dispatched > 0) activeDispatchDays += 1;
    console.log({
      date: r.order_date_day_pst,
      approved,
      dispatched,
      delivered: Number(r.delivered_quantity) || 0,
    });
  }

  const wa = activeDispatchDays > 0 ? sumDispatched / activeDispatchDays : null;
  console.log("\nTotals:");
  console.log("  Approved Qty (sum):", sumApproved);
  console.log("  Dispatched Qty (sum):", sumDispatched);
  console.log("  Active dispatch days:", activeDispatchDays);
  console.log("  Wtd. Avg = dispatched / active days:", wa?.toFixed(1));

  const { data: rpc } = await supabase.rpc("get_ops_sku_performance_sellers", {
    p_sku: sku,
    p_country: country,
    p_bifurcation: bifurcation,
    p_from_date: from,
    p_to_date: to,
    p_page: 1,
    p_page_size: 50,
  });
  const payload = rpc as { data?: Array<Record<string, unknown>> };
  const store = (payload.data ?? []).find((r) => Number(r.store_id) === storeId);
  console.log("\nRPC seller row:", store);
}

main().catch(console.error);
