import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { requireWriteAccess } from "@/lib/accessControl";
import { notifyStandardUsers } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["finance"]);
  if (denied) return denied;
  const authSession = session!;

  const body = await req.json().catch(() => ({}));
  const reason: string = body.reason ?? "";

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select("id, pr_number, approval_status, finance_verification_status, created_by_email, product_name, products")
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
      finance_verified_by_email: authSession.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    const productLabel = pr.products?.[0]?.productName ?? pr.product_name ?? "product";
    const prNumber = pr.pr_number ?? prId.slice(0, 8);
    await notifyStandardUsers(
      { creatorEmail: pr.created_by_email, roles: ["admin"] },
      "pr_finance_rejected",
      {
        pr_id: prId,
        pr_number: prNumber,
        message: `PR ${prNumber} (${productLabel}) payment was rejected by Finance`,
      }
    );
  } catch (notifError) {
    console.error("Failed to send finance reject notification:", notifError);
  }

  return NextResponse.json({ ok: true });
}
