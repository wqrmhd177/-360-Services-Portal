import { createSupabaseClient } from "@/lib/supabaseClient";

const BUCKET = "pr-payment-proofs";

const ALLOWED_INVOICE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  // Some browsers/OS send empty or generic type for xlsx/csv
  "application/octet-stream",
  ""
];

const ALLOWED_INVOICE_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".csv", ".xlsx", ".xls"
];

const MAX_INVOICE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadPoInvoice(
  file: File,
  poId: string,
  kind: "supplier" | "delivery"
): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Invoice file is required");
  }

  const extRaw = (file.name.split(".").pop() || "").toLowerCase();
  const extDotted = "." + extRaw;
  const typeOk = ALLOWED_INVOICE_TYPES.includes(file.type);
  const extOk = ALLOWED_INVOICE_EXTENSIONS.includes(extDotted);

  if (!typeOk && !extOk) {
    throw new Error(`Invalid invoice file type. Allowed: images, PDF, CSV, Excel. Got: "${file.type}" (${extDotted})`);
  }

  if (file.size > MAX_INVOICE_SIZE) {
    throw new Error("Invoice file too large");
  }

  const supabase = createSupabaseClient();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extRaw || "pdf"}`;
  const filePath = `po-invoices/${kind}/${poId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    throw new Error(error.message || "Invoice upload failed. Check storage bucket pr-payment-proofs exists.");
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return publicUrl;
}

