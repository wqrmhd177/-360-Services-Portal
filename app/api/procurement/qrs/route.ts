import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient();

  const { data: qrs } = await supabase
    .from("qr")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ qrs: qrs ?? [] });
}
