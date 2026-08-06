const ALLOWED_BUCKETS = new Set([
  "product_images",
  "product-listing-images",
  "qr-attachments",
  "pr-payment-proofs",
]);

export async function uploadFileToStorage(
  file: File,
  bucket: string,
  pathPrefix?: string,
  objectPath?: string,
): Promise<{ path: string; publicUrl: string | null }> {
  if (!ALLOWED_BUCKETS.has(bucket)) {
    throw new Error(`Bucket not allowed: ${bucket}`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  if (pathPrefix) formData.append("pathPrefix", pathPrefix);
  if (objectPath) formData.append("objectPath", objectPath);

  const res = await fetch("/api/upload/storage", { method: "POST", body: formData });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  return { path: json.path, publicUrl: json.publicUrl ?? null };
}

export async function uploadFilesToStorage(
  files: File[],
  bucket: string,
  pathPrefix?: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const { publicUrl } = await uploadFileToStorage(file, bucket, pathPrefix);
    if (publicUrl) urls.push(publicUrl);
  }
  return urls;
}
