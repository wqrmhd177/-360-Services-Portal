import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = session.role === "growth" || session.isAdmin;
  if (!canAccess) {
    return NextResponse.json(
      { error: "Forbidden - Growth role required" },
      { status: 403 }
    );
  }

  try {
    const supabase = createSupabaseClient();
    const { searchParams } = new URL(request.url);
    const createdByFilter = searchParams.get("createdBy")?.trim() || "";

    let query = supabase
      .from("qr")
      .select("*")
      .order("created_at", { ascending: false });

    if (session.isAdmin) {
      if (createdByFilter) {
        query = query.eq("created_by_email", createdByFilter);
      }
    } else {
      query = query.eq("created_by_email", session.email);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch QRs" }, { status: 500 });
  }
}
