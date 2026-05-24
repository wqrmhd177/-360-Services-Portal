import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getPortalSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canApprove = session.role === "approver" || session.role === "finance" || session.isAdmin;
    if (!canApprove) {
      return NextResponse.json(
        { error: "Forbidden - Approver or Finance role required" },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { remarks } = body;

    const supabase = createSupabaseClient();

    // Get PR to check status and get creator info
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

    // Approve PR
    const { error: updateError } = await supabase
      .from("pr")
      .update({
        approval_status: "approved",
        approved_by_email: session.email,
        approved_at: new Date().toISOString(),
        approval_remarks: remarks || null,
        pr_status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error approving PR:", updateError);
      return NextResponse.json(
        { error: "Failed to approve PR" },
        { status: 500 }
      );
    }

    // Send notifications
    try {
      // Notify PR creator (Growth user)
      await createNotification(
        pr.created_by_email,
        "pr_approved",
        {
          pr_id: id,
          pr_number: pr.pr_number,
          approved_by: session.email,
          message: `Your PR ${pr.pr_number || id.slice(0, 8)} has been approved`,
        }
      );

      // Notify Finance team
      const financeEmails = await getUsersByRole("finance");
      for (const email of financeEmails) {
        await createNotification(
          email,
          "pr_approved",
          {
            pr_id: id,
            pr_number: pr.pr_number,
            approved_by: session.email,
            message: `PR ${pr.pr_number || id.slice(0, 8)} approved - awaiting payment verification`,
          }
        );
      }
    } catch (notifError) {
      console.error("Error sending notifications:", notifError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in approve PR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
