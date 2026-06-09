import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus, PoStatus } from "@/types/workflows";

export type PoProductLine = {
  productName: string;
  skuCode?: string;
  quantity: number;
  rate?: number;
  amount?: number;
  productCostPerUnit?: number;
  productCostAmount?: number;
};

export type CreatePoInput = {
  pr_id: string | null;
  created_by_email: string;
  po_type: string;
  supplier_name: string;
  supplier_location: string;
  delivery_partner: string;
  delivery_partner_tracking_id: string;
  remarks: string | null;
  products?: PoProductLine[];
  supplier_payment_amount?: number | null;
  delivery_partner_payment_amount?: number | null;
};

/** Insert PO using core columns first (works without migration columns). */
export async function insertPurchaseOrder(
  supabase: SupabaseClient,
  input: CreatePoInput
): Promise<{ data: { id: string; po_number?: string | null } | null; error: string | null }> {
  const core = {
    pr_id: input.pr_id,
    created_by_email: input.created_by_email,
    status: "order_placed" as PoStatus,
    po_type: input.po_type,
    supplier_name: input.supplier_name,
    supplier_location: input.supplier_location,
    delivery_partner: input.delivery_partner,
    delivery_partner_tracking_id: input.delivery_partner_tracking_id,
    remarks: input.remarks,
    supplier_payment_status: "unpaid" as PaymentStatus,
    delivery_partner_payment_status: "unpaid" as PaymentStatus,
  };

  const result = await supabase.from("po").insert(core).select("id").single();

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error?.message ?? "Failed to insert purchase order",
    };
  }

  const poId = result.data.id;
  const optional: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.products && input.products.length > 0) {
    optional.products = input.products;
  }
  if (input.supplier_payment_amount != null && !Number.isNaN(input.supplier_payment_amount)) {
    optional.supplier_payment_amount = input.supplier_payment_amount;
  }
  if (
    input.delivery_partner_payment_amount != null &&
    !Number.isNaN(input.delivery_partner_payment_amount)
  ) {
    optional.delivery_partner_payment_amount = input.delivery_partner_payment_amount;
  }

  const optionalKeys = Object.keys(optional).filter((k) => k !== "updated_at");
  if (optionalKeys.length > 0) {
    const { error: updateError } = await supabase.from("po").update(optional).eq("id", poId);
    if (updateError) {
      console.warn("PO optional fields not saved:", updateError.message);
    }
  }

  let po_number: string | null = null;
  const { data: poRow } = await supabase.from("po").select("po_number").eq("id", poId).maybeSingle();
  if (poRow && typeof (poRow as { po_number?: string }).po_number === "string") {
    po_number = (poRow as { po_number: string }).po_number;
  }

  return { data: { id: poId, po_number }, error: null };
}
