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
  const reason: string = body.reason ?? "";

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select("id, pr_number, approval_status, finance_verification_status")
    .eq("id", prId)
    .single();

  if (fetchError || !pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  if (pr.approval_status !== "approved") {
    return NextResponse.json(
      { error: "PR must be approved before finance can act on it" },
      { status: 400 }
    );
  }

  if (pr.finance_verification_status !== "pending") {
    return NextResponse.json(
      { error: "PR has already been processed" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("pr")
    .update({
      finance_verification_status: "rejected",
      finance_remarks: reason || null,
      finance_verified_by_email: session.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
