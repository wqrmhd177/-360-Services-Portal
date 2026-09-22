import { getOpsServiceDb, getLastSync } from "@/lib/operations/opsDb";
import type { PickingProductRow } from "@/lib/operations/pickingSheet";
import {
  escapePickingIlike,
  parsePickingSearchTokens,
} from "@/lib/operations/pickingParse";

export type PickingProduct = {
  sku: string;
  product_name: string;
  image_url: string | null;
  source: "sheet" | "manual" | "bulk";
  updated_at: string | null;
};

const PAGE_SIZE_MAX = 100;

function isMissingTable(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  );
}

export async function listPickingProducts(
  search: string,
  page: number,
  limit: number,
): Promise<{ items: PickingProduct[]; total: number }> {
  const supabase = getOpsServiceDb();
  const safeLimit = Math.min(PAGE_SIZE_MAX, Math.max(1, limit));
  const q = search.trim();

  const tokens = parsePickingSearchTokens(q);
  const pageSize =
    tokens.length > 1
      ? Math.min(PAGE_SIZE_MAX, Math.max(safeLimit, tokens.length))
      : safeLimit;
  const rangeFrom = (Math.max(1, page) - 1) * pageSize;

  let query = supabase
    .from("ops_picking_products")
    .select("sku,product_name,image_url,source,updated_at", { count: "exact" })
    .order("product_name", { ascending: true })
    .range(rangeFrom, rangeFrom + pageSize - 1);

  if (tokens.length === 1) {
    const safe = escapePickingIlike(tokens[0]);
    if (safe) {
      query = query.or(`sku.ilike.%${safe}%,product_name.ilike.%${safe}%`);
    }
  } else if (tokens.length > 1) {
    const quoted = tokens
      .map((token) => `"${token.replace(/"/g, "")}"`)
      .join(",");
    const likes = tokens
      .map((token) => {
        const safe = escapePickingIlike(token);
        return `sku.ilike.%${safe}%,product_name.ilike.%${safe}%`;
      })
      .join(",");
    query = query.or(`sku.in.(${quoted}),${likes}`);
  }

  const { data, error, count } = await query;
  if (error) {
    if (isMissingTable(error.message)) {
      const err = new Error("MISSING_TABLE");
      throw err;
    }
    throw new Error(error.message);
  }

  return {
    items: (data ?? []) as PickingProduct[],
    total: count ?? 0,
  };
}

export async function lookupPickingProducts(
  skus: string[],
): Promise<PickingProduct[]> {
  const unique = [...new Set(skus.map((s) => s.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const supabase = getOpsServiceDb();
  const { data, error } = await supabase
    .from("ops_picking_products")
    .select("sku,product_name,image_url,source,updated_at")
    .in("sku", unique);
  if (error) throw new Error(error.message);
  return (data ?? []) as PickingProduct[];
}

export async function getPickingProduct(
  sku: string,
): Promise<PickingProduct | null> {
  const supabase = getOpsServiceDb();
  const { data, error } = await supabase
    .from("ops_picking_products")
    .select("sku,product_name,image_url,source,updated_at")
    .eq("sku", sku.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PickingProduct | null) ?? null;
}

export async function deletePickingProduct(sku: string): Promise<void> {
  const supabase = getOpsServiceDb();
  const { error } = await supabase
    .from("ops_picking_products")
    .delete()
    .eq("sku", sku.trim());
  if (error) throw new Error(error.message);
}

export async function savePickingProduct(row: {
  originalSku?: string;
  sku: string;
  product_name: string;
  image_url?: string | null;
  source: "sheet" | "manual" | "bulk";
  created_by?: string | null;
}): Promise<PickingProduct> {
  const sku = row.sku.trim();
  const originalSku = (row.originalSku ?? "").trim();
  if (originalSku && originalSku !== sku) {
    const existing = await getPickingProduct(sku);
    if (existing) {
      throw new Error(`SKU ${sku} already exists.`);
    }
    const current = await getPickingProduct(originalSku);
    const saved = await upsertPickingProduct({
      sku,
      product_name: row.product_name,
      image_url: row.image_url ?? current?.image_url ?? null,
      source: row.source,
      created_by: row.created_by,
    });
    await deletePickingProduct(originalSku);
    return saved;
  }
  return upsertPickingProduct(row);
}

export async function upsertPickingProduct(row: {
  sku: string;
  product_name: string;
  image_url?: string | null;
  source: "sheet" | "manual" | "bulk";
  created_by?: string | null;
}): Promise<PickingProduct> {
  const supabase = getOpsServiceDb();
  const payload: {
    sku: string;
    product_name: string;
    source: "sheet" | "manual" | "bulk";
    created_by: string | null;
    updated_at: string;
    image_url?: string;
  } = {
    sku: row.sku.trim(),
    product_name: row.product_name.trim(),
    source: row.source,
    created_by: row.created_by ?? null,
    updated_at: new Date().toISOString(),
  };
  if (row.image_url) payload.image_url = row.image_url;
  const { data, error } = await supabase
    .from("ops_picking_products")
    .upsert(payload, { onConflict: "sku" })
    .select("sku,product_name,image_url,source,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as PickingProduct;
}

export async function upsertPickingProductRows(
  rows: PickingProductRow[],
  createdBy?: string | null,
): Promise<number> {
  const supabase = getOpsServiceDb();
  const payload = rows.map((row) => ({
    sku: row.sku,
    product_name: row.product_name,
    image_url: row.image_url,
    sheet_image_url: row.sheet_image_url ?? row.image_url,
    source: row.source,
    created_by: createdBy ?? null,
  }));

  const { data, error } = await supabase.rpc("upsert_ops_picking_products", {
    p_rows: payload,
  });
  if (!error) return Number(data ?? rows.length);

  const msg = error.message.toLowerCase();
  if (!msg.includes("schema cache") && !msg.includes("could not find")) {
    throw new Error(error.message);
  }

  let written = 0;
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const skus = chunk.map((row) => row.sku);
    const { data: existing } = await supabase
      .from("ops_picking_products")
      .select("sku,image_url")
      .in("sku", skus);
    const keepImage = new Map(
      (existing ?? [])
        .filter((row) =>
          String(row.image_url ?? "").includes(
            "/storage/v1/object/public/product_images/",
          ),
        )
        .map((row) => [String(row.sku), String(row.image_url)]),
    );
    const merged = chunk.map((row) => ({
      ...row,
      image_url: keepImage.get(row.sku) ?? row.image_url,
    }));
    const { error: upErr } = await supabase
      .from("ops_picking_products")
      .upsert(merged, { onConflict: "sku" });
    if (upErr) {
      if (
        upErr.message.toLowerCase().includes("sheet_image_url") ||
        upErr.message.toLowerCase().includes("schema cache")
      ) {
        const legacy = merged.map(
          ({ sheet_image_url: _sheet, ...rest }) => rest,
        );
        const { error: legacyErr } = await supabase
          .from("ops_picking_products")
          .upsert(legacy, { onConflict: "sku" });
        if (legacyErr) throw new Error(legacyErr.message);
      } else {
        throw new Error(upErr.message);
      }
    }
    written += chunk.length;
  }
  return written;
}

export async function getPickingLastSynced(): Promise<string | null> {
  const last = await getLastSync("picking");
  return last?.synced_at ?? null;
}
