import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = getPortalSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const poId = (formData.get("poId") as string | null)?.trim() ?? null;
    const kind = (formData.get("kind") as string | null)?.trim() ?? null;
    const scope = (formData.get("scope") as string | null)?.trim() ?? null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File must be an image (JPEG, PNG, GIF, WebP) or PDF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size must be 5MB or less." },
        { status: 400 }
      );
    }

    // Optional: PO payment uploads use structured paths for later delete/edit.
    const isPoPayment = scope === "po_payment" && poId && (kind === "supplier" || kind === "delivery");

    const supabase = createSupabaseClient();

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExt = file.name.split(".").pop();
    const fileName = `${timestamp}-${randomString}.${fileExt}`;
    const filePath = isPoPayment
      ? `po-payments/${kind}/${poId}/${fileName}`
      : `payment-proofs/${fileName}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("pr-payment-proofs")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("pr-payment-proofs").getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      publicUrl,
      objectPath: filePath,
      fileName,
    });
  } catch (error) {
    console.error("Error in file upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
