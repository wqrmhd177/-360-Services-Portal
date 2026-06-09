import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { uploadPoInvoice } from "@/lib/poUploads";
import { insertPurchaseOrder } from "@/lib/poCreate";
import { buildPoProductsFromPr } from "@/lib/poProductCosts";
import type { ProcurementResponseMap } from "@/lib/procurementImages";
import { requireWriteAccess } from "@/lib/accessControl";

function getInvoiceFile(formData: FormData, field: string): File | null {
  const entry = formData.get(field);
  if (entry instanceof File && entry.size > 0) {
    return entry;
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(
    session,
    ["procurement"],
    "Forbidden - Procurement role required to convert PR to PO"
  );
  if (denied) return denied;
  const authSession = session!;

  const prId = params.id;

  try {
    const formData = await request.formData();

    const poType = String(formData.get("po_type") ?? "internal");
    const supplierName = String(formData.get("supplier_name") ?? "");
    const supplierLocation = String(formData.get("supplier_location") ?? "");
    const supplierInvoiceFile = getInvoiceFile(formData, "supplier_invoice_file");
    const supplierPaymentAmountRaw = formData.get("supplier_payment_amount");
    const supplierPaymentAmount =
      supplierPaymentAmountRaw !== null && supplierPaymentAmountRaw !== ""
        ? Number(supplierPaymentAmountRaw)
        : undefined;
    const deliveryPartner = String(formData.get("delivery_partner") ?? "");
    const deliveryPartnerTrackingId = String(formData.get("delivery_partner_tracking_id") ?? "");
    const deliveryPartnerInvoiceFile = getInvoiceFile(
      formData,
      "delivery_partner_invoice_file"
    );
    const deliveryPartnerPaymentAmountRaw = formData.get("delivery_partner_payment_amount");
    const deliveryPartnerPaymentAmount =
      deliveryPartnerPaymentAmountRaw !== null && deliveryPartnerPaymentAmountRaw !== ""
        ? Number(deliveryPartnerPaymentAmountRaw)
        : undefined;
    const remarks = (formData.get("remarks") as string | null) || null;

    if (
      !supplierName.trim() ||
      !supplierLocation.trim() ||
      !deliveryPartner.trim()
    ) {
      return NextResponse.json(
        { error: "Supplier name, location, and delivery partner are required." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    const { data: prDetails, error: prFetchError } = await supabase
      .from("pr")
      .select(
        "created_by_email, from_qr_id, products, product_name, sku_code, quantity, rate, approval_status, finance_verification_status, po_created"
      )
      .eq("id", prId)
      .single();

    if (prFetchError || !prDetails) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    if (prDetails.po_created) {
      return NextResponse.json(
        { error: "A purchase order already exists for this PR." },
        { status: 400 }
      );
    }

    if (prDetails.approval_status !== "approved") {
      return NextResponse.json(
        { error: "PR must be approved before creating a PO." },
        { status: 400 }
      );
    }

    if (prDetails.finance_verification_status !== "verified") {
      return NextResponse.json(
        { error: "PR must be finance-verified before creating a PO." },
        { status: 400 }
      );
    }

    let qr: {
      purchase_details?: Array<{ productName?: string }> | null;
      procurement_response?: ProcurementResponseMap | null;
    } | null = null;
    if (prDetails.from_qr_id) {
      const { data: qrRow } = await supabase
        .from("qr")
        .select("purchase_details, procurement_response")
        .eq("id", prDetails.from_qr_id)
        .maybeSingle();
      if (qrRow) {
        qr = {
          purchase_details: qrRow.purchase_details as Array<{ productName?: string }> | null,
          procurement_response: qrRow.procurement_response as ProcurementResponseMap | null,
        };
      }
    }

    const poProducts = buildPoProductsFromPr(
      prDetails.products as Parameters<typeof buildPoProductsFromPr>[0],
      {
        product_name: prDetails.product_name,
        sku_code: prDetails.sku_code,
        quantity: prDetails.quantity,
        rate: prDetails.rate,
      },
      qr
    );

    const { data: newPo, error: poError } = await insertPurchaseOrder(supabase, {
      pr_id: prId,
      created_by_email: authSession.email,
      po_type: poType,
      supplier_name: supplierName,
      supplier_location: supplierLocation,
      delivery_partner: deliveryPartner,
      delivery_partner_tracking_id: deliveryPartnerTrackingId,
      remarks,
      products: poProducts,
      supplier_payment_amount: supplierPaymentAmount ?? null,
      delivery_partner_payment_amount: deliveryPartnerPaymentAmount ?? null,
    });

    if (poError || !newPo) {
      console.error("Error creating PO:", poError);
      return NextResponse.json(
        { error: poError || "Failed to create PO" },
        { status: 500 }
      );
    }

    const warnings: string[] = [];
    const invoiceUpdates: Record<string, string> = {};

    if (supplierInvoiceFile) {
      try {
        invoiceUpdates.supplier_invoice_file = await uploadPoInvoice(
          supplierInvoiceFile,
          newPo.id,
          "supplier"
        );
      } catch (e) {
        warnings.push(
          `Supplier invoice: ${e instanceof Error ? e.message : "upload failed"}`
        );
      }
    }

    if (deliveryPartnerInvoiceFile) {
      try {
        invoiceUpdates.delivery_partner_invoice_file = await uploadPoInvoice(
          deliveryPartnerInvoiceFile,
          newPo.id,
          "delivery"
        );
      } catch (e) {
        warnings.push(
          `Delivery invoice: ${e instanceof Error ? e.message : "upload failed"}`
        );
      }
    }

    if (Object.keys(invoiceUpdates).length > 0) {
      const { error: invoiceUpdateError } = await supabase
        .from("po")
        .update(invoiceUpdates)
        .eq("id", newPo.id);
      if (invoiceUpdateError) {
        warnings.push(`Invoice URLs not saved: ${invoiceUpdateError.message}`);
      }
    }

    await supabase
      .from("pr")
      .update({ po_created: true, updated_at: new Date().toISOString() })
      .eq("id", prId);

    try {
      const financeEmails = await getUsersByRole("finance");
      const poLabel = newPo.po_number ?? newPo.id.slice(0, 8);
      const payload = {
        po_id: newPo.id,
        po_number: newPo.po_number ?? undefined,
        pr_id: prId,
        message: `New PO ${poLabel} created for ${supplierName}`,
      };
      if (financeEmails.length > 0) {
        await notifyMultipleUsers(financeEmails, "po_created", payload);
      }
      if (prDetails?.created_by_email) {
        await createNotification(prDetails.created_by_email, "po_created", {
          ...payload,
          message: `Your PR has been converted to PO ${poLabel}`,
        });
      }
    } catch (notifError) {
      console.error("PO notification error:", notifError);
    }

    return NextResponse.json({
      success: true,
      po_id: newPo.id,
      po_number: newPo.po_number,
      ...(warnings.length > 0 ? { warning: warnings.join("; ") } : {}),
    });
  } catch (error) {
    console.error("Error in PO creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
