import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = session.role === "finance" || session.isAdmin;
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("pr")
      .select("seller_service_type")
      .not("seller_service_type", "is", null)
      .neq("seller_service_type", "");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const serviceTypes = Array.from(
      new Set((data ?? []).map((row) => row.seller_service_type as string))
    ).sort();

    return NextResponse.json({ serviceTypes });
  } catch {
    return NextResponse.json({ error: "Failed to fetch service types" }, { status: 500 });
  }
}
