import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { lookupPickingProducts } from "@/lib/operations/picking";
import { getOpsDb } from "@/lib/operations/opsDb";
import {
  fetchPickingImageFromUrl,
  isPortalPickingImageUrl,
  pickingSafeSku,
  pickingStoragePathFromUrl,
} from "@/lib/operations/pickingUploads";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "product_images";

function imageResponse(body: Buffer, contentType: string, maxAge: number) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType || "image/jpeg",
      "Cache-Control": `private, max-age=${maxAge}`,
    },
  });
}

async function downloadFromBucket(path: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const supabase = getOpsDb();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length < 80) return null;
  return { buffer, contentType: data.type || "image/jpeg" };
}

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sku = String(request.nextUrl.searchParams.get("sku") ?? "").trim();
  if (!sku) {
    return NextResponse.json({ error: "SKU is required." }, { status: 400 });
  }

  try {
    const [product] = await lookupPickingProducts([sku]);
    if (!product?.image_url) {
      return new NextResponse(null, { status: 404 });
    }

    const safeSku = pickingSafeSku(product.sku);
    const fromUrl = pickingStoragePathFromUrl(product.image_url);
    const candidates = [
      fromUrl,
      `picking/${safeSku}.jpg`,
      `picking/${safeSku}.jpeg`,
      `picking/${safeSku}.png`,
      `picking/${safeSku}.webp`,
      `picking/${safeSku}.gif`,
    ].filter((path, index, all): path is string => Boolean(path) && all.indexOf(path) === index);

    if (isPortalPickingImageUrl(product.image_url) || fromUrl) {
      for (const path of candidates) {
        const stored = await downloadFromBucket(path);
        if (stored) return imageResponse(stored.buffer, stored.contentType, 86400);
      }
    }

    const remote = await fetchPickingImageFromUrl(product.image_url);
    return imageResponse(remote.buffer, remote.contentType, 3600);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
