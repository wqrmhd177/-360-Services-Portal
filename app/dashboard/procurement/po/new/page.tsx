import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import { uploadPoInvoice } from "@/lib/poUploads";
import { insertPurchaseOrder } from "@/lib/poCreate";
import { buildPoProductsFromPr } from "@/lib/poProductCosts";
import type { ProcurementResponseMap } from "@/lib/procurementImages";
import CreatePOForm from "./CreatePOForm";

async function createPo(formData: FormData) {
  "use server";
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const canCreate = session.role === "procurement" || session.isAdmin;
  if (!canCreate) {
    redirect("/dashboard/procurement/po");
  }

  const creationMode = String(formData.get("creation_mode") ?? "linked");
  const poType = String(formData.get("po_type") ?? "internal");
  const supplierName = String(formData.get("supplier_name") ?? "");
  const supplierLocation = String(formData.get("supplier_location") ?? "");
  const deliveryPartner = String(formData.get("delivery_partner") ?? "");
  const deliveryPartnerTrackingId = String(formData.get("delivery_partner_tracking_id") ?? "");
  const remarks = (formData.get("remarks") as string | null) || null;

  const supabase = createSupabaseClient();

  let prId: string | null = null;
  let products: Array<{ productName: string; skuCode?: string; quantity: number; rate?: number; amount?: number }> | null = null;

  if (creationMode === "linked") {
    const rawPrId = String(formData.get("pr_id") ?? "").trim();
    if (!rawPrId) {
      redirect("/dashboard/procurement/po/new?error=pr_required");
    }
    const { data: pr } = await supabase
      .from("pr")
      .select("id, created_by_email, from_qr_id, products, product_name, sku_code, quantity, rate")
      .eq("id", rawPrId)
      .single();
    if (!pr) {
      redirect("/dashboard/procurement/po/new?error=invalid_pr");
    }
    prId = pr.id;

    let qr: {
      purchase_details?: Array<{ productName?: string }> | null;
      procurement_response?: ProcurementResponseMap | null;
    } | null = null;
    if (pr.from_qr_id) {
      const { data: qrRow } = await supabase
        .from("qr")
        .select("purchase_details, procurement_response")
        .eq("id", pr.from_qr_id)
        .maybeSingle();
      if (qrRow) {
        qr = {
          purchase_details: qrRow.purchase_details as Array<{ productName?: string }> | null,
          procurement_response: qrRow.procurement_response as ProcurementResponseMap | null,
        };
      }
    }

    products = buildPoProductsFromPr(
      pr.products as Parameters<typeof buildPoProductsFromPr>[0],
      {
        product_name: pr.product_name,
        sku_code: pr.sku_code,
        quantity: pr.quantity,
        rate: pr.rate,
      },
      qr
    );
  } else {
    const productsJson = formData.get("products") as string | null;
    if (!productsJson) {
      redirect("/dashboard/procurement/po/new?error=products_required");
    }
    try {
      const parsed = JSON.parse(productsJson) as Array<{
        productName: string;
        skuCode?: string;
        quantity: number;
        rate?: number;
        amount?: number;
        productCostPerUnit?: number;
        product_cost?: number;
      }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        redirect("/dashboard/procurement/po/new?error=products_required");
      }
      products = parsed.map((p) => {
        const quantity = Number(p.quantity) || 0;
        const productCostPerUnit =
          p.productCostPerUnit != null
            ? Number(p.productCostPerUnit)
            : p.product_cost != null
              ? Number(p.product_cost)
              : undefined;
        return {
          productName: p.productName,
          skuCode: p.skuCode,
          quantity,
          rate: p.rate != null ? Number(p.rate) : undefined,
          amount: p.amount != null ? Number(p.amount) : undefined,
          productCostPerUnit,
          productCostAmount:
            productCostPerUnit != null ? productCostPerUnit * quantity : undefined,
        };
      });
    } catch {
      redirect("/dashboard/procurement/po/new?error=products_required");
    }
  }

  const supplierPaymentAmountRaw = formData.get("supplier_payment_amount");
  const deliveryPaymentAmountRaw = formData.get("delivery_partner_payment_amount");
  const supplierPaymentAmount =
    supplierPaymentAmountRaw !== null && supplierPaymentAmountRaw !== ""
      ? Number(supplierPaymentAmountRaw)
      : null;
  const deliveryPartnerPaymentAmount =
    deliveryPaymentAmountRaw !== null && deliveryPaymentAmountRaw !== ""
      ? Number(deliveryPaymentAmountRaw)
      : null;

  const { data: newPo, error: poError } = await insertPurchaseOrder(supabase, {
    pr_id: prId,
    created_by_email: session.email,
    po_type: poType,
    supplier_name: supplierName,
    supplier_location: supplierLocation,
    delivery_partner: deliveryPartner,
    delivery_partner_tracking_id: deliveryPartnerTrackingId,
    remarks,
    products: products ?? [],
    supplier_payment_amount: supplierPaymentAmount,
    delivery_partner_payment_amount: deliveryPartnerPaymentAmount,
  });

  if (poError || !newPo) {
    console.error("Create PO error:", poError);
    redirect(
      `/dashboard/procurement/po/new?error=create_failed&msg=${encodeURIComponent(poError || "Failed to create PO")}`
    );
  }

  if (prId) {
    await supabase
      .from("pr")
      .update({ po_created: true, updated_at: new Date().toISOString() })
      .eq("id", prId);
  }

  // Handle optional invoice file uploads
  const supplierInvoiceFileRaw = formData.get("supplier_invoice_file");
  const deliveryInvoiceFileRaw = formData.get("delivery_partner_invoice_file");

  const invoiceUpdates: Record<string, string> = {};
  const invoiceErrors: string[] = [];

  if (supplierInvoiceFileRaw instanceof File && supplierInvoiceFileRaw.size > 0) {
    try {
      const url = await uploadPoInvoice(supplierInvoiceFileRaw, newPo.id, "supplier");
      invoiceUpdates.supplier_invoice_file = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Supplier invoice upload failed";
      console.error("Supplier invoice upload failed:", e);
      invoiceErrors.push(`Supplier invoice: ${msg}`);
    }
  }

  if (deliveryInvoiceFileRaw instanceof File && deliveryInvoiceFileRaw.size > 0) {
    try {
      const url = await uploadPoInvoice(deliveryInvoiceFileRaw, newPo.id, "delivery");
      invoiceUpdates.delivery_partner_invoice_file = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delivery invoice upload failed";
      console.error("Delivery invoice upload failed:", e);
      invoiceErrors.push(`Delivery invoice: ${msg}`);
    }
  }

  if (Object.keys(invoiceUpdates).length > 0) {
    await supabase
      .from("po")
      .update({ ...invoiceUpdates, updated_at: new Date().toISOString() })
      .eq("id", newPo.id);
  }

  // Redirect with upload errors so user knows invoice wasn't saved
  if (invoiceErrors.length > 0) {
    const errMsg = encodeURIComponent(invoiceErrors.join("; "));
    redirect(`/dashboard/procurement/po/${newPo.id}?warn=invoice_upload_failed&msg=${errMsg}`);
  }

  const financeEmails = await getUsersByRole("finance");
  const poLabel = newPo.po_number ?? newPo.id.slice(0, 8);
  const payload = {
    po_id: newPo.id,
    po_number: newPo.po_number ?? undefined,
    message: `New PO ${poLabel} created for ${supplierName}`,
  };

  if (creationMode === "independent") {
    if (financeEmails.length > 0) {
      await notifyMultipleUsers(financeEmails, "po_created", payload);
    } else {
      await createNotification("finance@example.com", "po_created", payload);
    }
  } else {
    const linkedPayload = { ...payload, pr_id: prId ?? undefined };
    if (financeEmails.length > 0) {
      await notifyMultipleUsers(financeEmails, "po_created", linkedPayload);
    } else {
      await createNotification("finance@example.com", "po_created", linkedPayload);
    }
    const { data: prDetails } = await supabase
      .from("pr")
      .select("created_by_email")
      .eq("id", prId)
      .single();
    if (prDetails?.created_by_email && prId) {
      await createNotification(prDetails.created_by_email, "po_created", {
        po_id: newPo.id,
        po_number: newPo.po_number ?? undefined,
        pr_id: prId,
        message: `Your PR has been converted to PO ${poLabel}`,
      });
    }
  }

  redirect("/dashboard/procurement/po");
}

export default function ProcurementPoFormPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }
  const canCreate = session.role === "procurement" || session.isAdmin;
  if (!canCreate) {
    redirect("/dashboard/procurement/po");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
        Create Purchase Order (PO)
      </h2>
      <p className="text-sm text-gray-500">
        Link to a verified Purchase Request or create an independent PO. Assign Supplier and
        Delivery Partner details.
      </p>
      <CreatePOForm createPo={createPo} />
    </div>
  );
}
