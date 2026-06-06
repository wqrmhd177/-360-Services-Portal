import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = session.role === "approver" || session.isAdmin;
  if (!canAccess) {
    return NextResponse.json(
      { error: "Forbidden - Approver role required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get("createdBy")?.trim() || "";

    const supabase = createSupabaseClient();
    
    let query = supabase
      .from("po")
      .select("*, pr!inner(id, pr_number, created_by_email, products, product_name)")
      .order("created_at", { ascending: false });

    if (createdBy) {
      query = query.eq("pr.created_by_email", createdBy);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching POs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Failed to fetch POs:", error);
    return NextResponse.json({ error: "Failed to fetch POs" }, { status: 500 });
  }
}
