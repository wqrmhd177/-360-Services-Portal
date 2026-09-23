import { getOpsServiceDb } from "@/lib/operations/opsDb";
import type { PickingProduct } from "@/lib/operations/picking";

export type PickingAuditAction =
  | "created"
  | "name_changed"
  | "sku_changed"
  | "picture_changed"
  | "bulk_import";

export type PickingProductLog = {
  id: string;
  sku: string;
  action: PickingAuditAction;
  summary: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

type LogInput = {
  sku: string;
  action: PickingAuditAction;
  summary: string;
  old_value?: string | null;
  new_value?: string | null;
  changed_by?: string | null;
};

export async function appendPickingProductLog(input: LogInput): Promise<void> {
  const supabase = getOpsServiceDb();
  const { error } = await supabase.from("ops_picking_product_logs").insert([
    {
      sku: input.sku.trim(),
      action: input.action,
      summary: input.summary,
      old_value: input.old_value ?? null,
      new_value: input.new_value ?? null,
      changed_by: input.changed_by ?? null,
    },
  ]);
  if (error) {
    console.warn("ops_picking_product_logs insert failed:", error.message);
  }
}

export async function listPickingProductLogs(
  sku: string,
  limit = 50,
): Promise<PickingProductLog[]> {
  const supabase = getOpsServiceDb();
  const { data, error } = await supabase
    .from("ops_picking_product_logs")
    .select("id,sku,action,summary,old_value,new_value,changed_by,changed_at")
    .eq("sku", sku.trim())
    .order("changed_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) {
    if (error.message.toLowerCase().includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as PickingProductLog[];
}

export async function recordPickingProductChanges(input: {
  before: PickingProduct | null;
  after: PickingProduct;
  changed_by?: string | null;
  pictureChanged?: boolean;
}): Promise<void> {
  const { before, after, changed_by, pictureChanged } = input;
  const actor = changed_by ?? null;

  if (!before) {
    await appendPickingProductLog({
      sku: after.sku,
      action: "created",
      summary: "Product added",
      new_value: `${after.product_name} (${after.sku})`,
      changed_by: actor,
    });
    return;
  }

  if (before.sku !== after.sku) {
    await appendPickingProductLog({
      sku: after.sku,
      action: "sku_changed",
      summary: "SKU updated",
      old_value: before.sku,
      new_value: after.sku,
      changed_by: actor,
    });
  }

  if (before.product_name !== after.product_name) {
    await appendPickingProductLog({
      sku: after.sku,
      action: "name_changed",
      summary: "Product name updated",
      old_value: before.product_name,
      new_value: after.product_name,
      changed_by: actor,
    });
  }

  const beforeImage = before.image_url ?? "";
  const afterImage = after.image_url ?? "";
  if (pictureChanged || (beforeImage && afterImage && beforeImage !== afterImage)) {
    await appendPickingProductLog({
      sku: after.sku,
      action: "picture_changed",
      summary: "Product picture updated",
      old_value: beforeImage ? "Previous picture" : null,
      new_value: afterImage ? "New picture" : null,
      changed_by: actor,
    });
  } else if (!beforeImage && afterImage) {
    await appendPickingProductLog({
      sku: after.sku,
      action: "picture_changed",
      summary: "Product picture added",
      new_value: "Picture uploaded",
      changed_by: actor,
    });
  }
}

export async function recordPickingBulkImport(input: {
  sku: string;
  product_name: string;
  changed_by?: string | null;
  created: boolean;
}): Promise<void> {
  await appendPickingProductLog({
    sku: input.sku,
    action: "bulk_import",
    summary: input.created ? "Product added via bulk upload" : "Product updated via bulk upload",
    new_value: `${input.product_name} (${input.sku})`,
    changed_by: input.changed_by ?? null,
  });
}
