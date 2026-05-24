import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseClient } from "@/lib/supabaseClient";
import type { PaymentStatus, Po, PoStatus } from "@/types/workflows";

export const ALLOWED_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_PROOF_SIZE = 5 * 1024 * 1024; // 5MB
export const BUCKET = "pr-payment-proofs";

export const errorMessages: Record<string, string> = {
  proof_required: "Please upload a payment proof file.",
  invalid_file: "File must be an image (JPEG, PNG, GIF, WebP) or PDF.",
  file_too_large: "File must be 5MB or less.",
  upload_failed: "Upload failed. Please try again.",
  update_failed:
    "Could not update PO. Please try again or check permissions. (If this is new setup, run add_po_payment_proof_history.sql in Supabase.)",
  delete_failed: "Could not delete previous proof. Please try again.",
};

export function isSupplierPaymentEligibleStatus(status: PoStatus): boolean {
  if (status === "canceled") return false;
  const eligible: PoStatus[] = [
    "shipment_received_at_lp_warehouse",
    "shipment_received_at_destination_city",
    "shipment_received_at_destination_warehouse",
    "delivered",
  ];
  return eligible.includes(status);
}

export function isDeliveryPaymentEligibleStatus(status: PoStatus): boolean {
  return status === "delivered";
}

async function uploadPaymentProof(
  file: File,
  poId: string,
  kind: "supplier" | "delivery"
): Promise<string> {
  const supabase = createSupabaseClient();
  const ext = file.name.split(".").pop() || "pdf";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `po-${kind}/${poId}/${fileName}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: false });
  if (error) throw new Error("Upload failed");
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return publicUrl;
}

export async function getAllPos(): Promise<Po[]> {
  const supabase = createSupabaseClient();
  const { data } = await supabase
    .from("po")
    .select(
      "*, pr:pr_id(id, seller_channel_name, seller_service_type, movement_type, products, created_by_email, amount)"
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as Po[];
}

type ProofHistoryAction =
  | "uploaded"
  | "marked_paid"
  | "reverted_unpaid"
  | "deleted_proof"
  | "replaced_proof";

function appendHistory(
  existing: any,
  entry: { action: ProofHistoryAction; url?: string | null; by?: string | null; note?: string | null }
) {
  const arr = Array.isArray(existing) ? existing : [];
  return [
    ...arr,
    {
      action: entry.action,
      url: entry.url ?? null,
      by: entry.by ?? null,
      note: entry.note ?? null,
      at: new Date().toISOString(),
    },
  ];
}

function objectPathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message ?? "");
  // Postgres undefined_column is 42703; Supabase may not surface code consistently.
  return err?.code === "42703" || msg.toLowerCase().includes("column") || msg.toLowerCase().includes("does not exist");
}

export async function markSupplierPaymentPaidWithProofUrl(formData: FormData, redirectTo: string) {
  const poId = formData.get("poId") as string;
  const proofUrl = (formData.get("proofUrl") as string | null)?.trim() ?? "";
  const actor = (formData.get("actor") as string | null)?.trim() ?? null;
  const previousProofUrl = (formData.get("previousProofUrl") as string | null)?.trim() ?? null;

  if (!proofUrl) redirect(`${redirectTo}?error=proof_required`);

  const supabase = createSupabaseClient();

  const { data: existing, error: existingErr } = await supabase
    .from("po")
    .select("supplier_payment_proof_history")
    .eq("id", poId)
    .maybeSingle();
  if (existingErr) {
    console.error("supplier_payment_proof_history select failed:", existingErr);
  }

  const history = appendHistory((existing as any)?.supplier_payment_proof_history, {
    action: previousProofUrl && previousProofUrl !== proofUrl ? "replaced_proof" : "marked_paid",
    url: proofUrl,
    by: actor,
  });

  const { error } = await supabase
    .from("po")
    .update({
      supplier_payment_status: "paid" as PaymentStatus,
      supplier_payment_proof: proofUrl,
      supplier_payment_proof_history: history as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) {
    console.error("supplier mark paid update failed:", error);
    if (isMissingColumnError(error)) {
      // DB not migrated yet. Retry without history columns so core flow works.
      const { error: retryErr } = await supabase
        .from("po")
        .update({
          supplier_payment_status: "paid" as PaymentStatus,
          supplier_payment_proof: proofUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poId);
      if (retryErr) {
        console.error("supplier mark paid retry failed:", retryErr);
        redirect(`${redirectTo}?error=update_failed`);
      }
    } else {
      redirect(`${redirectTo}?error=update_failed`);
    }
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function markDeliveryPaymentPaidWithProofUrl(formData: FormData, redirectTo: string) {
  const poId = formData.get("poId") as string;
  const proofUrl = (formData.get("proofUrl") as string | null)?.trim() ?? "";
  const actor = (formData.get("actor") as string | null)?.trim() ?? null;
  const previousProofUrl = (formData.get("previousProofUrl") as string | null)?.trim() ?? null;

  if (!proofUrl) redirect(`${redirectTo}?error=proof_required`);

  const supabase = createSupabaseClient();

  const { data: existing, error: existingErr } = await supabase
    .from("po")
    .select("delivery_partner_payment_proof_history")
    .eq("id", poId)
    .maybeSingle();
  if (existingErr) {
    console.error("delivery_partner_payment_proof_history select failed:", existingErr);
  }

  const history = appendHistory((existing as any)?.delivery_partner_payment_proof_history, {
    action: previousProofUrl && previousProofUrl !== proofUrl ? "replaced_proof" : "marked_paid",
    url: proofUrl,
    by: actor,
  });

  const { error } = await supabase
    .from("po")
    .update({
      delivery_partner_payment_status: "paid" as PaymentStatus,
      delivery_partner_payment_proof: proofUrl,
      delivery_partner_payment_proof_history: history as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) {
    console.error("delivery mark paid update failed:", error);
    if (isMissingColumnError(error)) {
      const { error: retryErr } = await supabase
        .from("po")
        .update({
          delivery_partner_payment_status: "paid" as PaymentStatus,
          delivery_partner_payment_proof: proofUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poId);
      if (retryErr) {
        console.error("delivery mark paid retry failed:", retryErr);
        redirect(`${redirectTo}?error=update_failed`);
      }
    } else {
      redirect(`${redirectTo}?error=update_failed`);
    }
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function revertSupplierPaymentToUnpaid(formData: FormData, redirectTo: string) {
  const poId = formData.get("poId") as string;
  const actor = (formData.get("actor") as string | null)?.trim() ?? null;

  const supabase = createSupabaseClient();
  const { data: existing, error: existingErr } = await supabase
    .from("po")
    .select("supplier_payment_proof_history")
    .eq("id", poId)
    .maybeSingle();
  if (existingErr) console.error("supplier history select failed:", existingErr);

  const history = appendHistory((existing as any)?.supplier_payment_proof_history, {
    action: "reverted_unpaid",
    by: actor,
  });

  const { error } = await supabase
    .from("po")
    .update({
      supplier_payment_status: "unpaid" as PaymentStatus,
      supplier_payment_proof_history: history as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) {
    console.error("supplier revert update failed:", error);
    if (isMissingColumnError(error)) {
      const { error: retryErr } = await supabase
        .from("po")
        .update({
          supplier_payment_status: "unpaid" as PaymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poId);
      if (retryErr) redirect(`${redirectTo}?error=update_failed`);
    } else {
      redirect(`${redirectTo}?error=update_failed`);
    }
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function revertDeliveryPaymentToUnpaid(formData: FormData, redirectTo: string) {
  const poId = formData.get("poId") as string;
  const actor = (formData.get("actor") as string | null)?.trim() ?? null;

  const supabase = createSupabaseClient();
  const { data: existing, error: existingErr } = await supabase
    .from("po")
    .select("delivery_partner_payment_proof_history")
    .eq("id", poId)
    .maybeSingle();
  if (existingErr) console.error("delivery history select failed:", existingErr);

  const history = appendHistory((existing as any)?.delivery_partner_payment_proof_history, {
    action: "reverted_unpaid",
    by: actor,
  });

  const { error } = await supabase
    .from("po")
    .update({
      delivery_partner_payment_status: "unpaid" as PaymentStatus,
      delivery_partner_payment_proof_history: history as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) {
    console.error("delivery revert update failed:", error);
    if (isMissingColumnError(error)) {
      const { error: retryErr } = await supabase
        .from("po")
        .update({
          delivery_partner_payment_status: "unpaid" as PaymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poId);
      if (retryErr) redirect(`${redirectTo}?error=update_failed`);
    } else {
      redirect(`${redirectTo}?error=update_failed`);
    }
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function deleteSupplierPaymentProof(formData: FormData, redirectTo: string) {
  const poId = formData.get("poId") as string;
  const proofUrl = (formData.get("proofUrl") as string | null)?.trim() ?? "";
  const actor = (formData.get("actor") as string | null)?.trim() ?? null;

  if (!proofUrl) redirect(`${redirectTo}?error=delete_failed`);

  const objectPath = objectPathFromPublicUrl(proofUrl);
  const supabase = createSupabaseClient();

  if (objectPath) {
    const { error: delErr } = await supabase.storage.from(BUCKET).remove([objectPath]);
    if (delErr) redirect(`${redirectTo}?error=delete_failed`);
  }

  const { data: existing, error: existingErr } = await supabase
    .from("po")
    .select("supplier_payment_proof_history")
    .eq("id", poId)
    .maybeSingle();
  if (existingErr) console.error("supplier history select failed:", existingErr);

  const history = appendHistory((existing as any)?.supplier_payment_proof_history, {
    action: "deleted_proof",
    url: proofUrl,
    by: actor,
  });

  const { error } = await supabase
    .from("po")
    .update({
      supplier_payment_proof: null,
      supplier_payment_proof_history: history as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) {
    console.error("supplier delete proof update failed:", error);
    if (isMissingColumnError(error)) {
      const { error: retryErr } = await supabase
        .from("po")
        .update({
          supplier_payment_proof: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poId);
      if (retryErr) redirect(`${redirectTo}?error=update_failed`);
    } else {
      redirect(`${redirectTo}?error=update_failed`);
    }
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

export async function deleteDeliveryPaymentProof(formData: FormData, redirectTo: string) {
  const poId = formData.get("poId") as string;
  const proofUrl = (formData.get("proofUrl") as string | null)?.trim() ?? "";
  const actor = (formData.get("actor") as string | null)?.trim() ?? null;

  if (!proofUrl) redirect(`${redirectTo}?error=delete_failed`);

  const objectPath = objectPathFromPublicUrl(proofUrl);
  const supabase = createSupabaseClient();

  if (objectPath) {
    const { error: delErr } = await supabase.storage.from(BUCKET).remove([objectPath]);
    if (delErr) redirect(`${redirectTo}?error=delete_failed`);
  }

  const { data: existing, error: existingErr } = await supabase
    .from("po")
    .select("delivery_partner_payment_proof_history")
    .eq("id", poId)
    .maybeSingle();
  if (existingErr) console.error("delivery history select failed:", existingErr);

  const history = appendHistory((existing as any)?.delivery_partner_payment_proof_history, {
    action: "deleted_proof",
    url: proofUrl,
    by: actor,
  });

  const { error } = await supabase
    .from("po")
    .update({
      delivery_partner_payment_proof: null,
      delivery_partner_payment_proof_history: history as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (error) {
    console.error("delivery delete proof update failed:", error);
    if (isMissingColumnError(error)) {
      const { error: retryErr } = await supabase
        .from("po")
        .update({
          delivery_partner_payment_proof: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", poId);
      if (retryErr) redirect(`${redirectTo}?error=update_failed`);
    } else {
      redirect(`${redirectTo}?error=update_failed`);
    }
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

