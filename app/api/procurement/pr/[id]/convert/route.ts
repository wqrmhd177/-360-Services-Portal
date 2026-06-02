import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { uploadPoInvoice } from "@/lib/poUploads";
import type { PaymentStatus, PoStatus } from "@/types/workflows";

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
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canConvert = session.role === "procurement" || session.isAdmin;
  if (!canConvert) {
    return NextResponse.json(
      { error: "Forbidden - Procurement role required to convert PR to PO" },
      { status: 403 }
    );
  }

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

    const supabase = createSupabaseClient();

    // Get PR details (including products to copy into PO)
    const { data: prDetails } = await supabase
      .from("pr")
      .select("created_by_email, products, product_name, sku_code, quantity, rate")
      .eq("id", prId)
      .single();

    // Build product lines from PR to populate PO
    let poProducts: Array<{ productName: string; skuCode?: string; quantity: number; rate?: number; amount?: number }> = [];
    if (prDetails?.products && Array.isArray(prDetails.products) && prDetails.products.length > 0) {
      poProducts = prDetails.products.map((p: any) => ({
        productName: p.productName || p.product_name || "",
        skuCode: p.skuCode || p.sku_code || undefined,
        quantity: Number(p.quantity) || 0,
        rate: Number(p.sellingPricePerUnit || p.landedCostPrice || p.rate) || undefined,
        amount: Number(p.totalAmount || p.amount) || undefined,
      }));
    } else if (prDetails?.product_name) {
      // Legacy single-product PR
      poProducts = [{
        productName: prDetails.product_name,
        skuCode: prDetails.sku_code || undefined,
        quantity: Number(prDetails.quantity) || 0,
        rate: Number(prDetails.rate) || undefined,
        amount: Number(prDetails.rate) * Number(prDetails.quantity) || undefined,
      }];
    }

    // Create PO
    const { data: newPo, error: poError } = await supabase
      .from("po")
      .insert({
        pr_id: prId,
        products: poProducts,
        created_by_email: session.email,
        status: "order_placed" as PoStatus,
        po_type: poType,
        supplier_name: supplierName,
        supplier_location: supplierLocation,
        supplier_payment_amount: supplierPaymentAmount ?? null,
        delivery_partner: deliveryPartner,
        delivery_partner_tracking_id: deliveryPartnerTrackingId,
        delivery_partner_payment_amount: deliveryPartnerPaymentAmount ?? null,
        remarks,
        supplier_payment_status: "unpaid" as PaymentStatus,
        delivery_partner_payment_status: "unpaid" as PaymentStatus,
      })
      .select("id, po_number")
      .single();

    if (poError) {
      console.error("Error creating PO:", poError);
      return NextResponse.json({ error: "Failed to create PO" }, { status: 500 });
    }

    const invoiceUpdates: Record<string, string> = {};
    try {
      if (supplierInvoiceFile) {
        invoiceUpdates.supplier_invoice_file = await uploadPoInvoice(
          supplierInvoiceFile,
          newPo.id,
          "supplier"
        );
      }
      if (deliveryPartnerInvoiceFile) {
        invoiceUpdates.delivery_partner_invoice_file = await uploadPoInvoice(
          deliveryPartnerInvoiceFile,
          newPo.id,
          "delivery"
        );
      }
    } catch (uploadError) {
      console.error("PO invoice upload failed:", uploadError);
      await supabase.from("po").delete().eq("id", newPo.id);
      return NextResponse.json(
        {
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to upload invoice file"
        },
        { status: 400 }
      );
    }

    if (Object.keys(invoiceUpdates).length > 0) {
      const { error: invoiceUpdateError } = await supabase
        .from("po")
        .update(invoiceUpdates)
        .eq("id", newPo.id);
      if (invoiceUpdateError) {
        console.error("Error saving invoice URLs:", invoiceUpdateError);
        return NextResponse.json(
          { error: "Failed to save invoice files" },
          { status: 500 }
        );
      }
    }

    // Mark PR as PO created
    await supabase
      .from("pr")
      .update({
        po_created: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prId);

    if (newPo) {
      const financeEmails = await getUsersByRole("finance");
      const payload = {
        po_id: newPo.id,
        po_number: newPo.po_number,
        pr_id: prId,
        message: `New PO ${newPo.po_number || newPo.id.slice(0, 8)} created for ${supplierName}`,
      };

      // Notify Finance team
      if (financeEmails.length > 0) {
        await notifyMultipleUsers(financeEmails, "po_created", payload);
      } else {
        await createNotification("finance@example.com", "po_created", payload);
      }

      // Notify Growth user who created the original PR
      if (prDetails?.created_by_email) {
        await createNotification(prDetails.created_by_email, "po_created", {
          po_id: newPo.id,
          po_number: newPo.po_number,
          pr_id: prId,
          message: `Your PR has been converted to PO ${newPo.po_number || newPo.id.slice(0, 8)}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      po_id: newPo.id,
      po_number: newPo.po_number,
    });
  } catch (error) {
    console.error("Error in PO creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
