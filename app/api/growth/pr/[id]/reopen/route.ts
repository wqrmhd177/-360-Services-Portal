import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification } from "@/lib/notifications";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select("id, pr_number, created_by_email, approval_status, finance_verification_status, pr_status")
    .eq("id", prId)
    .single();

  if (fetchError || !pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  // Only the PR creator (Growth) or Admin can reopen
  const isOwner = session.email === pr.created_by_email;
  if (!isOwner && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden — only the PR creator or admin can reopen" }, { status: 403 });
  }

  // Must be rejected at approver or finance stage
  const approverRejected = pr.approval_status === "rejected";
  const financeRejected = pr.finance_verification_status === "rejected";

  if (!approverRejected && !financeRejected) {
    return NextResponse.json(
      { error: "PR is not in a rejected state and cannot be reopened" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (approverRejected) {
    updates.approval_status = "pending";
    updates.pr_status = "pending";
    updates.rejection_reason = null;
    updates.rejected_at = null;
    // Also reset finance status so the full flow restarts
    updates.finance_verification_status = "pending";
    updates.finance_verified_by_email = null;
    updates.finance_rejection_reason = null;
    updates.finance_verified_at = null;
  } else if (financeRejected) {
    // Only finance stage rejected — approver approval stays
    updates.finance_verification_status = "pending";
    updates.finance_verified_by_email = null;
    updates.finance_rejection_reason = null;
    updates.finance_verified_at = null;
  }

  const { error: updateError } = await supabase
    .from("pr")
    .update(updates)
    .eq("id", prId);

  if (updateError) {
    console.error("Error reopening PR:", updateError);
    return NextResponse.json({ error: "Failed to reopen PR" }, { status: 500 });
  }

  // Notify approvers if approver-rejected; notify finance if finance-rejected
  try {
    if (approverRejected) {
      await createNotification(pr.created_by_email, "pr_reopened", {
        pr_id: prId,
        pr_number: pr.pr_number,
        reopened_by: session.email,
        message: `PR ${pr.pr_number || prId.slice(0, 8)} has been reopened and is pending approval again`,
      });
    }
  } catch (notifError) {
    console.error("Notification error:", notifError);
  }

  return NextResponse.json({ ok: true });
}
