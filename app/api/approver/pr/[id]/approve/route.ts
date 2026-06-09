import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";
import { isFinanceSkipService } from "@/lib/serviceTypes";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getPortalSession();
    const denied = requireWriteAccess(
      session,
      ["approver", "finance"],
      "Forbidden - Approver or Finance role required"
    );
    if (denied) return denied;
    const authSession = session!;

    const { id } = params;
    const body = await request.json();
    const { remarks } = body;

    const supabase = createSupabaseClient();

    const { data: pr, error: fetchError } = await supabase
      .from("pr")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !pr) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    if (pr.approval_status !== "pending") {
      return NextResponse.json(
        { error: "PR has already been processed" },
        { status: 400 }
      );
    }

    const serviceType = pr.seller_service_type as string | undefined;
    const skipFinance = isFinanceSkipService(serviceType);
    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      approval_status: "approved",
      approved_by_email: authSession.email,
      approved_at: now,
      approval_remarks: remarks || null,
      pr_status: "approved",
      updated_at: now,
    };

    if (skipFinance) {
      updatePayload.finance_verification_status = "verified";
      updatePayload.finance_verified_by_email = authSession.email;
      updatePayload.finance_verified_at = now;
      updatePayload.finance_remarks = `Auto-verified — finance not required for ${serviceType}`;
    }

    const { error: updateError } = await supabase
      .from("pr")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      console.error("Error approving PR:", updateError);
      return NextResponse.json(
        { error: "Failed to approve PR" },
        { status: 500 }
      );
    }

    const prNumber = pr.pr_number || id.slice(0, 8);
    const productLabel =
      pr.products?.[0]?.productName ?? pr.product_name ?? "product";

    try {
      if (skipFinance) {
        await notifyStandardUsers(
          { creatorEmail: pr.created_by_email, roles: ["admin", "procurement"] },
          "pr_finance_verified",
          {
            pr_id: id,
            pr_number: prNumber,
            message: `PR ${prNumber} (${productLabel}) is approved and ready for PO conversion (${serviceType})`,
          }
        );
      } else {
        await notifyStandardUsers(
          { creatorEmail: pr.created_by_email, roles: ["admin", "finance"] },
          "pr_approved",
          {
            pr_id: id,
            pr_number: prNumber,
            approved_by: authSession.email,
            message: `PR ${prNumber} has been approved`,
          }
        );
      }
    } catch (notifError) {
      console.error("Error sending notifications:", notifError);
    }

    return NextResponse.json({ ok: true, finance_skipped: skipFinance });
  } catch (error) {
    console.error("Error in approve PR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
