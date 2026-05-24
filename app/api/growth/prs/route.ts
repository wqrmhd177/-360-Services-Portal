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
    let query = supabase
      .from("pr")
      .select("*")
      .order("created_at", { ascending: false });

    // Admin sees all PRs; regular growth users see only their own
    if (!session.isAdmin) {
      query = query.eq("created_by_email", session.email);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch PRs" }, { status: 500 });
  }
}
