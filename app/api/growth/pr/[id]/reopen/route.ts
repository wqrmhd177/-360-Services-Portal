import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only Growth or Admin can reopen PRs
  if (session.role !== "growth" && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden — Growth role required" }, { status: 403 });
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

  // Only the PR creator or Admin can reopen
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
    // Clear stale approver metadata
    updates.approved_by_email = null;
    updates.approved_at = null;
    updates.approval_remarks = null;
    // Also reset finance status so the full flow restarts cleanly
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

  // Notify the relevant team that the PR is back in their queue
  try {
    const notifPayload = {
      pr_id: prId,
      pr_number: pr.pr_number,
      reopened_by: session.email,
      message: `PR ${pr.pr_number || prId.slice(0, 8)} has been reopened and is pending review`,
    };

    // #region agent log
    fetch('http://127.0.0.1:7764/ingest/d1ead4db-e7ce-43dc-9e13-a703fdb1f6ba',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2da502'},body:JSON.stringify({sessionId:'2da502',location:'pr/reopen/route.ts:notifications',message:'PR reopen notification target',data:{approverRejected,financeRejected,prCreator:pr.created_by_email,actor:session.email},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{});
    // #endregion

    if (approverRejected) {
      // Notify approver team so they know PR is back in their queue
      const approverEmails = await getUsersByRole("approver");
      if (approverEmails.length > 0) {
        await notifyMultipleUsers(approverEmails, "pr_reopened", notifPayload);
      }
      // Also confirm to the Growth user who reopened it
      await createNotification(pr.created_by_email, "pr_reopened", {
        ...notifPayload,
        message: `Your PR ${pr.pr_number || prId.slice(0, 8)} has been reopened and sent for approval`,
      });
    } else if (financeRejected) {
      // Notify finance team
      const financeEmails = await getUsersByRole("finance");
      if (financeEmails.length > 0) {
        await notifyMultipleUsers(financeEmails, "pr_reopened", notifPayload);
      }
      await createNotification(pr.created_by_email, "pr_reopened", {
        ...notifPayload,
        message: `Your PR ${pr.pr_number || prId.slice(0, 8)} has been reopened for finance review`,
      });
    }
  } catch (notifError) {
    console.error("Notification error:", notifError);
  }

  return NextResponse.json({ ok: true });
}
