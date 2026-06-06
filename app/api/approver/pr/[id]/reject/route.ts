import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";

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
    const reason: string = typeof body.reason === "string" ? body.reason.trim() : "";

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

    // Reject PR
    const { error: updateError } = await supabase
      .from("pr")
      .update({
        approval_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || null,
        pr_status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error rejecting PR:", updateError);
      return NextResponse.json(
        { error: "Failed to reject PR" },
        { status: 500 }
      );
    }

    try {
      await notifyStandardUsers(
        { creatorEmail: pr.created_by_email, roles: ["admin", "approver"] },
        "pr_rejected",
        {
          pr_id: id,
          pr_number: pr.pr_number,
          rejected_by: authSession.email,
          reason: reason,
          message: `Your PR ${pr.pr_number || id.slice(0, 8)} has been rejected`,
        }
      );
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in reject PR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
