import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus, PoStatus } from "@/types/workflows";

export type PoProductLine = {
  productName: string;
  skuCode?: string;
  quantity: number;
  rate?: number;
  amount?: number;
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

/** Insert PO using core columns; retries without optional migration columns if needed. */
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

  const optional: Record<string, unknown> = {};
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

  let result = await supabase
    .from("po")
    .insert({ ...core, ...optional })
    .select("id, po_number")
    .single();

  if (!result.error && result.data) {
    return { data: result.data, error: null };
  }

  const firstError = result.error?.message ?? "Unknown error";
  const missingColumn =
    firstError.includes("column") ||
    firstError.includes("schema cache") ||
    result.error?.code === "PGRST204";

  if (!missingColumn) {
    return { data: null, error: firstError };
  }

  result = await supabase.from("po").insert(core).select("id, po_number").single();

  if (result.error || !result.data) {
    return { data: null, error: result.error?.message ?? firstError };
  }

  const poId = result.data.id;
  const followUp: Record<string, unknown> = { ...optional, updated_at: new Date().toISOString() };
  if (Object.keys(optional).length > 0) {
    const { error: updateError } = await supabase.from("po").update(followUp).eq("id", poId);
    if (updateError) {
      console.warn("PO created but optional fields not saved:", updateError.message);
    }
  }

  return { data: result.data, error: null };
}
