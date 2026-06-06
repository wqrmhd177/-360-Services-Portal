import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookie = cookies().get("portal_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = JSON.parse(cookie);
    if (session.role !== "approver" && !session.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Approver role required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get("createdBy")?.trim() || "";

    const supabase = createSupabaseClient();
    
    let query = supabase
      .from("qr")
      .select("*")
      .order("created_at", { ascending: false });

    if (createdBy) {
      query = query.eq("created_by_email", createdBy);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Failed to fetch QRs:", error);
    return NextResponse.json({ error: "Failed to fetch QRs" }, { status: 500 });
  }
}
