import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";
import { canAddPaymentToMovementsPr } from "@/lib/growthPrAccess";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getPortalSession();
    const denied = requireWriteAccess(session, ["growth"], "Forbidden - Growth role required");
    if (denied) return denied;
    const authSession = session!;

    const body = await request.json();
    const {
      payment_type,
      transaction_id,
      payment_proof_path,
      payment_entries: body_payment_entries,
    } = body;

    const payment_entries =
      Array.isArray(body_payment_entries) && body_payment_entries.length > 0
        ? body_payment_entries.map(
            (e: { transaction_id?: string | null; payment_proof_path?: string | null }) => ({
              transaction_id: e?.transaction_id ?? null,
              payment_proof_path: e?.payment_proof_path ?? null,
            })
          )
        : transaction_id != null || payment_proof_path != null
          ? [
              {
                transaction_id: transaction_id ?? null,
                payment_proof_path: payment_proof_path ?? null,
              },
            ]
          : null;

    if (!payment_type) {
      return NextResponse.json({ error: "Payment type is required" }, { status: 400 });
    }

    if (!payment_entries || payment_entries.length === 0) {
      return NextResponse.json(
        { error: "At least one payment entry is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const { data: pr, error: fetchError } = await supabase
      .from("pr")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !pr) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    if (pr.created_by_email !== authSession.email && !authSession.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canAddPaymentToMovementsPr(pr)) {
      return NextResponse.json(
        { error: "This PR is not awaiting payment details" },
        { status: 400 }
      );
    }

    let primaryTransactionId: string | null = null;
    const firstWithId = payment_entries.find(
      (e) => e.transaction_id != null && `${e.transaction_id}`.trim() !== ""
    );
    if (firstWithId?.transaction_id) {
      primaryTransactionId = `${firstWithId.transaction_id}`.trim();
    }

    if (primaryTransactionId) {
      const { data: existingPrs, error: txLookupError } = await supabase
        .from("pr")
        .select("id, pr_number")
        .eq("transaction_id", primaryTransactionId)
        .neq("id", params.id)
        .limit(1);

      if (txLookupError) {
        return NextResponse.json(
          { error: "Failed to validate transaction ID" },
          { status: 500 }
        );
      }

      if (existingPrs && existingPrs.length > 0) {
        return NextResponse.json(
          { error: "Error: duplicate transaction ID" },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      payment_type,
      payment_entries,
      transaction_id: payment_entries[0]?.transaction_id ?? null,
      payment_proof_path: payment_entries[0]?.payment_proof_path ?? null,
      pr_status: "approved",
      updated_at: now,
    };

    const { error: updateError } = await supabase
      .from("pr")
      .update(updatePayload)
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const prNumber = pr.pr_number || params.id.slice(0, 8);
    const productLabel =
      pr.products?.[0]?.productName ?? pr.product_name ?? "product";

    try {
      await notifyStandardUsers(
        { creatorEmail: pr.created_by_email, roles: ["admin", "finance"] },
        "pr_approved",
        {
          pr_id: params.id,
          pr_number: prNumber,
          approved_by: authSession.email,
          message: `Movement PR ${prNumber} (${productLabel}) payment submitted — ready for Finance verification`,
        }
      );
    } catch (notifError) {
      console.error("Error sending notifications:", notifError);
    }

    return NextResponse.json({ ok: true, pr_id: params.id });
  } catch (error) {
    console.error("Error adding payment to Movements PR:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
