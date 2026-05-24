import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import type { PaymentStatus, PoStatus } from "@/types/workflows";
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
    const { data: pr } = await supabase.from("pr").select("id, created_by_email").eq("id", rawPrId).single();
    if (!pr) {
      redirect("/dashboard/procurement/po/new?error=invalid_pr");
    }
    prId = pr.id;
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
