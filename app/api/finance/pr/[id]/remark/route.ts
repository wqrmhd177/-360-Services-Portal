import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess = session.role === "finance" || session.isAdmin;
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const remark: string = body.remark ?? "";

  const supabase = createSupabaseClient();

  const { error } = await supabase
    .from("pr")
    .update({
      finance_remarks: remark || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
