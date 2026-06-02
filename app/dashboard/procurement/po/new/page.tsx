import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import type { PaymentStatus, PoStatus } from "@/types/workflows";
import { uploadPoInvoice } from "@/lib/poUploads";
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
      .select("id, created_by_email, products, product_name, sku_code, quantity, rate")
      .eq("id", rawPrId)
      .single();
    if (!pr) {
      redirect("/dashboard/procurement/po/new?error=invalid_pr");
    }
    prId = pr.id;
    // Copy PR products into PO so SKUs/quantities are always visible
    if (pr.products && Array.isArray(pr.products) && pr.products.length > 0) {
      products = pr.products.map((p: any) => ({
        productName: p.productName || p.product_name || "",
        skuCode: p.skuCode || p.sku_code || undefined,
        quantity: Number(p.quantity) || 0,
        rate: Number(p.sellingPricePerUnit || p.landedCostPrice || p.rate) || undefined,
        amount: Number(p.totalAmount || p.amount) || undefined,
      }));
    } else if (pr.product_name) {
      products = [{
        productName: pr.product_name,
        skuCode: pr.sku_code || undefined,
        quantity: Number(pr.quantity) || 0,
        rate: Number(pr.rate) || undefined,
        amount: Number(pr.rate) * Number(pr.quantity) || undefined,
      }];
    }
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
      }>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        redirect("/dashboard/procurement/po/new?error=products_required");
      }
      products = parsed;
    } catch {
      redirect("/dashboard/procurement/po/new?error=products_required");
    }
  }

  const { data: newPo, error: poError } = await supabase
    .from("po")
    .insert({
      pr_id: prId,
      products: products ?? [],
      created_by_email: session.email,
      status: "order_placed" as PoStatus,
      po_type: poType,
      supplier_name: supplierName,
      supplier_location: supplierLocation,
      delivery_partner: deliveryPartner,
      delivery_partner_tracking_id: deliveryPartnerTrackingId,
      remarks,
      supplier_payment_status: "unpaid" as PaymentStatus,
      delivery_partner_payment_status: "unpaid" as PaymentStatus,
    })
    .select("id, po_number")
    .single();

  if (poError) {
    console.error("Create PO error:", poError);
    redirect("/dashboard/procurement/po/new?error=create_failed");
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
  const payload = {
    po_id: newPo.id,
    po_number: newPo.po_number,
    message: `New PO ${newPo.po_number || newPo.id.slice(0, 8)} created for ${supplierName}`,
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
        po_number: newPo.po_number,
        pr_id: prId,
        message: `Your PR has been converted to PO ${newPo.po_number || newPo.id.slice(0, 8)}`,
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
