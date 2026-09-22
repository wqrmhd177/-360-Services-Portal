import http from "node:http";
import https from "node:https";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pickingSkuFromFileName } from "@/lib/operations/pickingParse";

export { pickingSkuFromFileName };

const BUCKET = "product_images";
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_SIZE = 8 * 1024 * 1024;
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 12_000,
});
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 16,
  maxFreeSockets: 8,
});

let storageClient: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient {
  if (!storageClient) storageClient = createSupabaseServiceClient();
  return storageClient;
}

export function isPortalPickingImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("/storage/v1/object/public/product_images/");
}

export function pickingSafeSku(sku: string): string {
  return sku.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function pickingPictureApiPath(sku: string): string {
  return `/api/operations/picking/picture?sku=${encodeURIComponent(sku)}`;
}

export function withPickingPictureUrl<
  T extends { sku: string; image_url: string | null },
>(row: T, origin?: string): T {
  if (!row.image_url) return row;
  const path = pickingPictureApiPath(row.sku);
  return { ...row, image_url: origin ? `${origin}${path}` : path };
}

export function pickingStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const markers = [
    "/object/public/product_images/",
    "/object/sign/product_images/",
    "/object/authenticated/product_images/",
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      try {
        return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
      } catch {
        return url.slice(idx + marker.length).split("?")[0];
      }
    }
  }
  return null;
}

export async function uploadPickingImage(file: File, sku: string): Promise<string> {
  if (!IMAGE_TYPES.has(file.type) && !/\.(jpe?g|png|gif|webp)$/i.test(file.name)) {
    throw new Error("Product picture must be JPG, PNG, GIF, or WebP.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Product picture is too large (max 8MB).");
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeSku = pickingSafeSku(sku);
  const path = `picking/${safeSku}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
    cacheControl: "86400",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadPickingImageBuffer(
  buffer: Buffer,
  sku: string,
  contentType: string,
): Promise<string> {
  const type = IMAGE_TYPES.has(contentType) ? contentType : "image/jpeg";
  if (buffer.length > MAX_SIZE) {
    throw new Error("Product picture is too large (max 8MB).");
  }
  const ext =
    type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg";
  const safeSku = pickingSafeSku(sku);
  const path = `picking/${safeSku}.${ext}`;
  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: type,
    upsert: true,
    cacheControl: "86400",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function driveFileId(url: string): string | null {
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  const pathId = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return pathId ? pathId[1] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadBuffer(
  url: string,
  timeoutMs = 12_000,
  redirects = 0,
): Promise<{ buffer: Buffer; contentType: string; status: number }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error("Invalid image URL"));
      return;
    }
    const lib = parsed.protocol === "http:" ? http : https;
    const agent = parsed.protocol === "http:" ? httpAgent : httpsAgent;
    const req = lib.get(
      url,
      {
        agent,
        timeout: timeoutMs,
        headers: { "User-Agent": "360-portal-picking-images/1.0" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          if (redirects >= 5) {
            res.resume();
            reject(new Error("Too many redirects"));
            return;
          }
          res.resume();
          resolve(downloadBuffer(new URL(location, url).toString(), timeoutMs, redirects + 1));
          return;
        }
        if (status >= 400) {
          res.resume();
          reject(Object.assign(new Error(`HTTP ${status} for image URL`), { status }));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: (res.headers["content-type"] ?? "image/jpeg")
              .split(";")[0]
              .trim(),
            status,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Image download timed out"));
    });
    req.on("error", reject);
  });
}

export async function fetchPickingImageFromUrl(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const candidates: string[] = [];
  const id = driveFileId(url);
  if (id) {
    candidates.push(`https://drive.google.com/thumbnail?id=${id}&sz=w1000`);
    candidates.push(`https://lh3.googleusercontent.com/d/${id}=w1000`);
    candidates.push(`https://drive.google.com/uc?export=download&id=${id}&confirm=t`);
    candidates.push(`https://drive.google.com/uc?id=${id}&export=download`);
  }
  if (!candidates.includes(url)) candidates.push(url);

  let lastError = "Could not download picture.";
  for (const candidate of candidates) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { buffer, contentType, status } = await downloadBuffer(candidate);
        if (status === 429 || status === 503) {
          lastError = `HTTP ${status} for image URL`;
          await sleep(400 * (attempt + 1));
          continue;
        }
        if (buffer.length < 80) {
          lastError = "Image was empty.";
          break;
        }
        if (contentType.includes("text/html")) {
          lastError =
            "Image URL returned a web page instead of a file. Share the Drive folder as Anyone with the link.";
          break;
        }
        return { buffer, contentType: contentType || "image/jpeg" };
      } catch (err) {
        const status = (err as { status?: number }).status;
        lastError = err instanceof Error ? err.message : "download failed";
        if (status === 429 || status === 503) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(lastError);
}
