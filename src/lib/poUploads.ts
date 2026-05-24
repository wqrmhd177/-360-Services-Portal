import { createSupabaseClient } from "@/lib/supabaseClient";

const BUCKET = "pr-payment-proofs";

const ALLOWED_INVOICE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf"
];

const MAX_INVOICE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadPoInvoice(
  file: File,
  poId: string,
  kind: "supplier" | "delivery"
): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Invoice file is required");
  }

  if (!ALLOWED_INVOICE_TYPES.includes(file.type)) {
    throw new Error("Invalid invoice file type");
  }

  if (file.size > MAX_INVOICE_SIZE) {
    throw new Error("Invoice file too large");
  }

  const supabase = createSupabaseClient();
  const ext = file.name.split(".").pop() || "pdf";
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
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
    throw new Error("Upload failed");
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return publicUrl;
}

