import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { requireWriteAccess } from "@/lib/accessControl";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["finance"]);
  if (denied) return denied;

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select("id, finance_verification_status")
    .eq("id", prId)
    .single();

  if (fetchError || !pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  if (pr.finance_verification_status === "pending") {
    return NextResponse.json({ error: "PR finance status is already pending" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("pr")
    .update({
      finance_verification_status: "pending",
      finance_verified_by_email: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
