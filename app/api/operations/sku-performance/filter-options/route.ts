import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getOpsDb } from "@/lib/operations/opsDb";

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getOpsDb();
    const { data, error } = await supabase.rpc("get_ops_orders_filter_options_v2");
    if (error) throw new Error(error.message);

    const payload = (data ?? {}) as {
      countries?: string[];
      bifurcations?: string[];
    };

    return NextResponse.json({
      countries: payload.countries ?? [],
      bifurcations: payload.bifurcations ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load filter options";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
