import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getPortalSession } from "@/lib/session";
import { savePickingProduct } from "@/lib/operations/picking";
import { uploadPickingImage } from "@/lib/operations/pickingUploads";

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getPortalSession();
  try {
    const form = await request.formData();
    const sku = String(form.get("sku") ?? "").trim();
    const originalSku = String(form.get("original_sku") ?? "").trim();
    const productName = String(form.get("product_name") ?? "").trim();
    const file = form.get("image");
    if (!sku || !productName) {
      return NextResponse.json(
        { error: "SKU and product name are required." },
        { status: 400 },
      );
    }

    let imageUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      imageUrl = await uploadPickingImage(file, sku);
    }

    const product = await savePickingProduct({
      originalSku,
      sku,
      product_name: productName,
      image_url: imageUrl,
      source: "manual",
      created_by: session?.email ?? null,
    });
    return NextResponse.json({ ok: true, item: product });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save product";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
