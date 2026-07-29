/** Quick check: RPC with order vs without for one missing order */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fetchRpc(ordered) {
  const rows = [];
  let offset = 0;
  while (true) {
    let q = supabase.rpc("get_ops_orders_filtered_enriched", {
      p_from_date: "2026-07-01",
      p_to_date: "2026-07-14",
    });
    if (ordered) q = q.order("id", { ascending: true });
    const { data, error } = await q.range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function main() {
  for (const ordered of [false, true]) {
    const rows = await fetchRpc(ordered);
    const ids = new Set(rows.map((r) => r.order_id));
    const lineIds = new Set(rows.map((r) => r.id));
    console.log(
      `ordered=${ordered}: rows=${rows.length} unique line id=${lineIds.size} unique order_id=${ids.size}`,
    );
  }

  const { data } = await supabase
    .from("ops_orders_items")
    .select("*")
    .eq("order_id", 821263);
  console.log("\nOrder 821263 lines:", data?.length);
  for (const l of data || []) {
    console.log(" ", l.id, l.country, l.bifurcation, l.order_date_day);
  }
}

main();
