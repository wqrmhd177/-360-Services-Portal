import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { getUsersByRole, notifyMultipleUsers, createNotification } from "@/lib/notifications";

export async function POST(
  _req: NextRequest,
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

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select("id, pr_number, product_name, products, approval_status, finance_verification_status")
    .eq("id", prId)
    .single();

  if (fetchError || !pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  if (pr.approval_status !== "approved") {
    return NextResponse.json({ error: "PR must be approved before finance verification" }, { status: 400 });
  }

  if (pr.finance_verification_status !== "pending") {
    return NextResponse.json({ error: "PR has already been processed" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("pr")
    .update({
      finance_verification_status: "verified",
      finance_verified_by_email: session.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notify procurement team
  try {
    const productLabel = pr.products?.[0]?.productName ?? pr.product_name ?? "product";
    const prNumber = pr.pr_number ?? prId.slice(0, 8);
    const procurementEmails = await getUsersByRole("procurement");
    if (procurementEmails.length > 0) {
      await notifyMultipleUsers(procurementEmails, "pr_finance_verified", {
        pr_id: prId,
        pr_number: prNumber,
        message: `PR ${prNumber} (${productLabel}) is finance-verified and ready for PO conversion`,
      });
    } else {
      await createNotification("procurement@example.com", "pr_finance_verified", {
        pr_id: prId,
        pr_number: prNumber,
        message: `PR ${prNumber} (${productLabel}) is finance-verified and ready for PO conversion`,
      });
    }
  } catch {
    // notifications are non-critical
  }

  return NextResponse.json({ ok: true });
}
