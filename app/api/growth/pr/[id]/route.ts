import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { canEditGrowthPr } from "@/lib/growthPrAccess";
import { notifyStandardUsers } from "@/lib/notifications";
import { requireWriteAccess } from "@/lib/accessControl";
import { validateProductsAgainstQr } from "@/lib/qrQuantityValidation";

async function loadPrForGrowth(prId: string, session: { email: string; isAdmin?: boolean }) {
  const supabase = createSupabaseClient();
  let query = supabase.from("pr").select("*").eq("id", prId);
  if (!session.isAdmin) {
    query = query.eq("created_by_email", session.email);
  }
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "growth" && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pr = await loadPrForGrowth(params.id, session);
  if (!pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  return NextResponse.json(pr);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["growth"]);
  if (denied) return denied;
  const authSession = session!;

  const pr = await loadPrForGrowth(params.id, authSession);
  if (!pr) {
    return NextResponse.json({ error: "PR not found" }, { status: 404 });
  }

  if (!canEditGrowthPr(pr)) {
    return NextResponse.json(
      { error: "This PR cannot be edited in its current state." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    seller_channel_name,
    seller_user_id,
    seller_service_type,
    products,
    payment_type,
    payment_entries: body_payment_entries,
    transaction_id,
    payment_proof_path,
    remarks,
  } = body;

  if (!seller_channel_name || !seller_user_id || !seller_service_type) {
    return NextResponse.json({ error: "Seller information is required" }, { status: 400 });
  }

  if (!products || !Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: "At least one product is required" }, { status: 400 });
  }

  for (const product of products) {
    if (
      !product.productName ||
      !product.skuCode ||
      !product.destinationCountry ||
      !product.quantity ||
      !product.sellingPricePerUnit
    ) {
      return NextResponse.json({ error: "All product fields are required" }, { status: 400 });
    }
  }

  if (!payment_type) {
    return NextResponse.json({ error: "Payment type is required" }, { status: 400 });
  }

  if (pr.from_qr_id) {
    const supabase = createSupabaseClient();
    const { data: qr } = await supabase
      .from("qr")
      .select("purchase_details")
      .eq("id", pr.from_qr_id)
      .single();
    if (qr) {
      const qtyError = validateProductsAgainstQr(products, qr);
      if (qtyError) {
        return NextResponse.json({ error: qtyError }, { status: 400 });
      }
    }
  }

  const payment_entries =
    Array.isArray(body_payment_entries) && body_payment_entries.length > 0
      ? body_payment_entries.map(
          (e: { transaction_id?: string | null; payment_proof_path?: string | null }) => ({
            transaction_id: e?.transaction_id ?? null,
            payment_proof_path: e?.payment_proof_path ?? null,
          })
        )
      : transaction_id != null || payment_proof_path != null
        ? [{ transaction_id: transaction_id ?? null, payment_proof_path: payment_proof_path ?? null }]
        : null;

  const firstProduct = products[0];
  const totalAmount = products.reduce(
    (sum: number, p: { totalAmount?: number; quantity?: number; sellingPricePerUnit?: number }) =>
      sum + (p.totalAmount ?? (p.quantity ?? 0) * (p.sellingPricePerUnit ?? 0)),
    0
  );

  const updates: Record<string, unknown> = {
    seller_channel_name,
    seller_user_id,
    seller_service_type,
    products,
    payment_type,
    remarks: remarks ?? null,
    product_name: firstProduct.productName,
    sku_code: firstProduct.skuCode,
    quantity: firstProduct.quantity,
    rate: firstProduct.sellingPricePerUnit,
    amount: totalAmount,
    reseller_code: seller_channel_name,
    countries: [firstProduct.destinationCountry],
    shipping_type: firstProduct.shippingType || "sea",
    movement_type: firstProduct.movementType || "normal",
    payment_method: payment_type,
    updated_at: new Date().toISOString(),
  };

  if (payment_entries?.length) {
    updates.payment_entries = payment_entries;
    updates.transaction_id = payment_entries[0]?.transaction_id ?? null;
    updates.payment_proof_path = payment_entries[0]?.payment_proof_path ?? null;
  }

  const wasApproverRejected = pr.approval_status === "rejected";
  const wasFinanceRejected = pr.finance_verification_status === "rejected";

  if (wasApproverRejected) {
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
  } else if (wasFinanceRejected) {
    Object.assign(updates, {
      finance_verification_status: "pending",
      finance_verified_by_email: null,
      finance_remarks: null,
    });
  }

  const supabase = createSupabaseClient();
  const { error: updateError } = await supabase.from("pr").update(updates).eq("id", params.id);

  if (updateError) {
    console.error("Error updating PR:", updateError);
    return NextResponse.json(
      { error: updateError.message || "Failed to update PR" },
      { status: 500 }
    );
  }

  if (wasApproverRejected || updates.approval_status === "pending") {
    try {
      await notifyStandardUsers(
        { creatorEmail: authSession.email, roles: ["admin", "approver"] },
        "pr_created",
        {
          pr_id: params.id,
          pr_number: pr.pr_number,
          created_by: authSession.email,
          message: `PR ${pr.pr_number || params.id.slice(0, 8)} was updated and resubmitted for approval`,
        }
      );
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }
  } else if (wasFinanceRejected) {
    try {
      await notifyStandardUsers(
        { creatorEmail: authSession.email, roles: ["admin", "finance"] },
        "pr_reopened",
        {
          pr_id: params.id,
          pr_number: pr.pr_number,
          reopened_by: authSession.email,
          message: `PR ${pr.pr_number || params.id.slice(0, 8)} was updated and resubmitted for finance review`,
        }
      );
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }
  }

  return NextResponse.json({ ok: true });
}
