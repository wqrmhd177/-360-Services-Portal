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
  const { data, error } = await supabase.rpc("get_ops_sku_performance_summary", {
    p_country: null,
    p_bifurcation: null,
    p_from_date: "2026-07-01",
    p_to_date: "2026-07-25",
    p_search: null,
    p_sort_by: "approved_quantity",
    p_sort_direction: "desc",
    p_page: 1,
    p_page_size: 10,
  });

  if (error) {
    console.error("RPC error:", error);
    return;
  }

  console.log("Raw RPC type:", typeof data, Array.isArray(data));
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));
}

main();
