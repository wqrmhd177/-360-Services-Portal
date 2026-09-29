/** Client-safe helpers for picking product image URLs (no Node.js imports). */

export function isPortalPickingImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("/storage/v1/object/public/product_images/");
}

/** URL suitable for img src in printable HTML (public Supabase or http(s) links). */
export function pickingDocumentImageSrc(
  imageUrl: string | null | undefined,
): string | null {
  const url = String(imageUrl ?? "").trim();
  if (!url) return null;
  if (isPortalPickingImageUrl(url)) {
    return url.split("?")[0];
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return null;
}
