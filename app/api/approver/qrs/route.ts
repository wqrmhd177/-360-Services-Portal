import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { cookies } from "next/headers";

export async function GET() {
  const cookie = cookies().get("portal_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = JSON.parse(cookie);
    if (session.role !== "approver" && !session.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Approver role required" }, { status: 403 });
    }

    const supabase = createSupabaseClient();
    
    // Approver can view all QRs (read-only)
    const { data, error } = await supabase
      .from("qr")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Failed to fetch QRs:", error);
    return NextResponse.json({ error: "Failed to fetch QRs" }, { status: 500 });
  }
}
