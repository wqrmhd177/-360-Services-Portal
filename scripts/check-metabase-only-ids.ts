import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const ids = fs
  .readFileSync(
    path.join(process.cwd(), "scripts/order-id-exports/metabase-only-ids_2026-07-01_2026-07-15.txt"),
    "utf8",
  )
  .split(/\r?\n/)
  .filter(Boolean)
  .map(Number);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let inDb = 0;
let inDbWrongDay = 0;
let notInDb = 0;
const samples: unknown[] = [];

async function main() {
  for (const id of ids.slice(0, 20)) {
    const { data } = await sb
      .from("ops_orders_items")
      .select("order_id, order_date, order_date_day, country, bifurcation")
      .eq("order_id", id)
      .limit(2);
    if (!data?.length) {
      notInDb++;
      samples.push({ id, status: "NOT_IN_SUPABASE" });
    } else {
      inDb++;
      const day = data[0].order_date_day;
      if (day < "2026-07-01" || day > "2026-07-15") inDbWrongDay++;
      samples.push({ id, status: "IN_DB", rows: data });
    }
  }

  console.log({
    metabaseOnlyChecked: Math.min(20, ids.length),
    inDb,
    notInDb,
    inDbWrongDay,
    samples,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
