import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { canReopenGrowthPr } from "@/lib/growthPrAccess";
import { forbiddenResponse, requireWriteAccess } from "@/lib/accessControl";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["growth"], "Forbidden — Growth role required");
  if (denied) return denied;
  const authSession = session!;

  const supabase = createSupabaseClient();
  const prId = params.id;

  const { data: pr, error: fetchError } = await supabase
    .from("pr")
    .select(
      "id, pr_number, created_by_email, approval_status, finance_verification_status, po_created"
    )
    .eq("id", prId)
    .single();

  if (fetchError || !pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  const isOwner = session!.email === pr.created_by_email;
  if (!isOwner) {
    return forbiddenResponse("Forbidden — only the PR creator can reopen");
  }

  if (!canReopenGrowthPr(pr)) {
    return NextResponse.json(
      {
        error: pr.po_created
          ? "Cannot reopen a PR that already has a purchase order."
          : "PR is not in a rejected state and cannot be reopened.",
      },
      { status: 400 }
    );
  }

  const approverRejected = pr.approval_status === "rejected";
  const financeRejected = pr.finance_verification_status === "rejected";

  // Core columns from setup_database + migrate_pr_po_multi_product (avoid optional columns that may be missing)
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (approverRejected) {
    Object.assign(updates, {
      approval_status: "pending",
      pr_status: "pending",
      rejection_reason: null,
      rejected_at: null,
      approved_by_email: null,
      approval_remarks: null,
      finance_verification_status: "pending",
      finance_verified_by_email: null,
      finance_remarks: null,
    });
  } else if (financeRejected) {
    Object.assign(updates, {
      finance_verification_status: "pending",
      finance_verified_by_email: null,
      finance_remarks: null,
    });
  }

  const { error: updateError } = await supabase.from("pr").update(updates).eq("id", prId);

  if (updateError) {
    console.error("Error reopening PR:", updateError);
    return NextResponse.json(
      { error: updateError.message || "Failed to reopen PR" },
      { status: 500 }
    );
  }

  try {
    const notifPayload = {
      pr_id: prId,
      pr_number: pr.pr_number,
      reopened_by: authSession.email,
      message: `PR ${pr.pr_number || prId.slice(0, 8)} has been reopened and is pending review`,
    };

    if (approverRejected) {
      const approverEmails = await getUsersByRole("approver");
      if (approverEmails.length > 0) {
        await notifyMultipleUsers(approverEmails, "pr_reopened", notifPayload);
      }
      await createNotification(pr.created_by_email, "pr_reopened", {
        ...notifPayload,
        message: `Your PR ${pr.pr_number || prId.slice(0, 8)} has been reopened and sent for approval`,
      });
    } else if (financeRejected) {
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

  return NextResponse.json({ ok: true, editUrl: `/dashboard/growth/pr/${prId}/edit` });
}
