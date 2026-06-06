import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { requireWriteAccess } from "@/lib/accessControl";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["finance"]);
  if (denied) return denied;

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
