import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";
import { validateProductsAgainstQr } from "@/lib/qrQuantityValidation";

/** Add N working days (Mon–Fri) to a date. */
function addWorkingDays(fromDate: Date, workingDays: number): Date {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < workingDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/** True if still within 3 working days of last response/re-edit (rates valid); after that reconfirm required. */
function canConvertQrToPr(qr: { status: string; updated_at?: string | null }): boolean {
  if (qr.status !== "responded") return false;
  const updatedAt = qr.updated_at;
  if (!updatedAt) return true;
  const from = new Date(updatedAt);
  const eligibleFrom = addWorkingDays(from, 3);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eligibleFrom.setHours(0, 0, 0, 0);
  return today < eligibleFrom;
}

export async function POST(request: NextRequest) {
  try {
    const session = getPortalSession();
    const denied = requireWriteAccess(session, ["growth"], "Forbidden - Growth role required");
    if (denied) return denied;
    const authSession = session!;

    const body = await request.json();
    const {
      from_qr_id,
      seller_channel_name,
      seller_user_id,
      seller_service_type,
      products,
      payment_type,
      transaction_id,
      payment_proof_path,
      payment_entries: body_payment_entries,
      remarks,
    } = body;

    // Prefer payment_entries array; fall back to single transaction_id/payment_proof_path
    const payment_entries =
      Array.isArray(body_payment_entries) && body_payment_entries.length > 0
        ? body_payment_entries.map((e: { transaction_id?: string | null; payment_proof_path?: string | null }) => ({
            transaction_id: e?.transaction_id ?? null,
            payment_proof_path: e?.payment_proof_path ?? null,
          }))
        : transaction_id != null || payment_proof_path != null
          ? [{ transaction_id: transaction_id ?? null, payment_proof_path: payment_proof_path ?? null }]
          : null;

    // Validation
    if (!seller_channel_name || !seller_user_id || !seller_service_type) {
      return NextResponse.json(
        { error: "Seller information is required" },
        { status: 400 }
      );
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "At least one product is required" },
        { status: 400 }
      );
    }

    // Validate each product
    for (const product of products) {
      if (
        !product.productName ||
        !product.skuCode ||
        !product.destinationCountry ||
        !product.quantity ||
        !product.sellingPricePerUnit
      ) {
        return NextResponse.json(
          { error: "All product fields are required" },
          { status: 400 }
        );
      }
    }

    if (!payment_type) {
      return NextResponse.json(
        { error: "Payment type is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // When creating PR from a QR, enforce 3 working days since last response/re-edit
    if (from_qr_id) {
      const { data: qr } = await supabase
        .from("qr")
        .select("id, status, updated_at, purchase_details")
        .eq("id", from_qr_id)
        .single();
      if (qr && qr.status === "responded" && !canConvertQrToPr(qr)) {
        return NextResponse.json(
          {
            error:
              "Convert to PR is allowed only within 3 working days of last response or re-edit by Procurement. After that, please reconfirm rates with Procurement before converting.",
          },
          { status: 400 }
        );
      }
      if (qr && Array.isArray(products)) {
        const qtyError = validateProductsAgainstQr(products, qr);
        if (qtyError) {
          return NextResponse.json({ error: qtyError }, { status: 400 });
        }
      }
    }

    // Determine primary transaction ID (for uniqueness enforcement)
    let primaryTransactionId: string | null = null;
    if (payment_entries && Array.isArray(payment_entries)) {
      const firstWithId = payment_entries.find(
        (e: { transaction_id?: string | null }) =>
          e.transaction_id != null && `${e.transaction_id}`.trim() !== ""
      );
      if (firstWithId?.transaction_id) {
        primaryTransactionId = `${firstWithId.transaction_id}`.trim();
      }
    }
    if (!primaryTransactionId && transaction_id != null) {
      const trimmed = `${transaction_id}`.trim();
      if (trimmed !== "") {
        primaryTransactionId = trimmed;
      }
    }

    // If we have a transaction ID, ensure it's not used in any existing PR
    if (primaryTransactionId) {
      const { data: existingPrs, error: txLookupError } = await supabase
        .from("pr")
        .select("id, pr_number")
        .eq("transaction_id", primaryTransactionId)
        .limit(1);

      if (txLookupError) {
        console.error("Error checking existing transaction ID:", txLookupError);
        return NextResponse.json(
          { error: "Failed to validate transaction ID" },
          { status: 500 }
        );
      }

      if (existingPrs && existingPrs.length > 0) {
        return NextResponse.json(
          {
            error: "Error: duplicate transaction ID",
          },
          { status: 400 }
        );
      }
    }

    const insertPayload: Record<string, unknown> = {
      from_qr_id: from_qr_id || null,
      created_by_email: authSession.email,
      seller_channel_name,
      seller_user_id,
      seller_service_type,
      products,
      payment_type,
      remarks: remarks || null,
      pr_status: "pending",
      approval_status: "pending",
      finance_verification_status: "pending",
      po_created: false,
    };
    if (payment_entries != null && payment_entries.length > 0) {
      // Save the full array to the JSONB column (requires migrate_pr_payment_entries.sql to have been run)
      insertPayload.payment_entries = payment_entries;
      // Also mirror entry[0] into the scalar columns for backward compatibility with older code paths
      insertPayload.transaction_id = payment_entries[0]?.transaction_id ?? null;
      insertPayload.payment_proof_path = payment_entries[0]?.payment_proof_path ?? null;
    } else {
      insertPayload.transaction_id = transaction_id || null;
      insertPayload.payment_proof_path = payment_proof_path || null;
    }

    const { data: newPr, error: insertError } = await supabase
      .from("pr")
      .insert(insertPayload)
      .select("id, pr_number")
      .single();

    if (insertError || !newPr) {
      console.error("Error creating PR:", insertError);
      const message =
        insertError?.message ||
        (typeof insertError === "object" && insertError !== null && "details" in insertError
          ? String((insertError as { details?: string }).details)
          : null);
      return NextResponse.json(
        {
          error: message
            ? `Failed to create PR: ${message}`
            : "Failed to create PR",
        },
        { status: 500 }
      );
    }

    try {
      await notifyStandardUsers(
        { creatorEmail: authSession.email, roles: ["admin", "approver"] },
        "pr_created",
        {
          pr_id: newPr.id,
          pr_number: newPr.pr_number,
          created_by: authSession.email,
          message: `New PR ${newPr.pr_number} created by ${authSession.email}`,
        }
      );
    } catch (notifError) {
      console.error("Error sending notifications:", notifError);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({
      ok: true,
      pr_id: newPr.id,
      pr_number: newPr.pr_number,
    });
  } catch (error) {
    console.error("Error in PR creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
