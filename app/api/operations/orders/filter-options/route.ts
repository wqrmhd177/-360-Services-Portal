import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getOpsDb } from "@/lib/operations/opsDb";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getOpsDb();
    const { data, error } = await supabase.rpc("get_ops_orders_filter_options");
    if (error) throw new Error(error.message);

    const countries: string[] = [];
    const bifurcations: string[] = [];

    for (const row of (data ?? []) as Array<{ opt_type: string; opt_value: string }>) {
      if (row.opt_type === "country") countries.push(row.opt_value);
      else if (row.opt_type === "bifurcation") bifurcations.push(row.opt_value);
    }

    const { data: storeData } = await supabase
      .from("ops_orders_items")
      .select("store_id")
      .not("store_id", "is", null)
      .order("store_id", { ascending: true });

    const storeIds = [...new Set((storeData ?? []).map((r: { store_id: number }) => r.store_id))];

    return NextResponse.json({ countries, bifurcations, storeIds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load filter options";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
