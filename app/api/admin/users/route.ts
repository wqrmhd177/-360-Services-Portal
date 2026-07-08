import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET() {
  const session = getPortalSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, team, permissions")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Failed to fetch users:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data ?? [] });
  } catch (error) {
    console.error("Users list error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
