import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("page_size") ?? "100", 10) || 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: qrs } = await supabase
    .from("qr")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  return NextResponse.json({ qrs: qrs ?? [] });
}
