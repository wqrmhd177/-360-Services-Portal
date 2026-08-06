import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

const ALLOWED_BUCKETS = new Set([
  "product_images",
  "product-listing-images",
  "qr-attachments",
  "pr-payment-proofs",
]);

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = String(formData.get("bucket") ?? "").trim();
    const pathPrefix = String(formData.get("pathPrefix") ?? "").trim();
    const objectPathRaw = String(formData.get("objectPath") ?? "").trim();

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const safePrefix = pathPrefix
      ? pathPrefix.replace(/[^a-zA-Z0-9._/-]/g, "_")
      : "";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = objectPathRaw
      ? objectPathRaw.replace(/[^a-zA-Z0-9._/-]/g, "_")
      : safePrefix
        ? `${safePrefix}/${fileName}`
        : fileName;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return NextResponse.json({
      path: data.path,
      publicUrl: urlData?.publicUrl ?? null,
    });
  } catch (error) {
    console.error("upload/storage:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
