import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";
import { isFinanceSkipService } from "@/lib/serviceTypes";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["finance"]);
  if (denied) return denied;
  const authSession = session!;

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select("id, pr_number, product_name, products, approval_status, finance_verification_status, created_by_email, seller_service_type")
    .eq("id", prId)
    .single();

  if (fetchError || !pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  if (pr.approval_status !== "approved") {
    return NextResponse.json({ error: "PR must be approved before finance verification" }, { status: 400 });
  }

  if (isFinanceSkipService(pr.seller_service_type)) {
    return NextResponse.json(
      { error: "Finance verification is not required for this service type" },
      { status: 400 }
    );
  }

  if (pr.finance_verification_status !== "pending") {
    return NextResponse.json({ error: "PR has already been processed" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("pr")
    .update({
      finance_verification_status: "verified",
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
      { creatorEmail: pr.created_by_email, roles: ["admin", "procurement"] },
      "pr_finance_verified",
      {
        pr_id: prId,
        pr_number: prNumber,
        message: `PR ${prNumber} (${productLabel}) is finance-verified and ready for PO conversion`,
      }
    );
  } catch {
    // notifications are non-critical
  }

  return NextResponse.json({ ok: true });
}
