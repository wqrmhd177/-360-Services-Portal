import { createSupabaseClient } from "@/lib/supabaseClient";
import { countryFilterVariants } from "@/lib/country-normalization";
import { normalizeSkuForMatch } from "@/lib/operations/inventory";
import { fetchInventoryPage } from "@/lib/operations/syncInventory";
import { searchInventoryMatches } from "@/lib/inventoryLookup";

export type MovementInventoryLookup = {
  sku: string;
  country: string;
  product_name: string | null;
  available_quantity: number;
  po_quantity: number;
  movement_quantity: number;
  found: boolean;
};

function countryMatches(stored: string, filterCountry: string): boolean {
  const variants = countryFilterVariants(filterCountry);
  const norm = stored.trim().toLowerCase();
  return variants.some((v) => v.trim().toLowerCase() === norm);
}

export async function lookupMovementInventory(
  sku: string,
  country: string,
): Promise<MovementInventoryLookup> {
  const skuTrim = sku.trim();
  const countryTrim = country.trim();
  const empty: MovementInventoryLookup = {
    sku: skuTrim,
    country: countryTrim,
    product_name: null,
    available_quantity: 0,
    po_quantity: 0,
    movement_quantity: 0,
    found: false,
  };

  if (!skuTrim || !countryTrim) return empty;

  try {
    const { items } = await fetchInventoryPage(skuTrim, 1, 50);
    const skuNorm = normalizeSkuForMatch(skuTrim);
    const exact = items.find(
      (row) =>
        normalizeSkuForMatch(row.sku) === skuNorm &&
        countryMatches(row.country, countryTrim),
    );
    if (exact) {
      return {
        sku: exact.sku,
        country: exact.country,
        product_name: exact.product_name || null,
        available_quantity: Number(exact.available_quantity) || 0,
        po_quantity: Number(exact.po_quantity) || 0,
        movement_quantity: Number(exact.movement_quantity) || 0,
        found: true,
      };
    }
  } catch {
    /* fall through to Metabase search */
  }

  try {
    const result = await searchInventoryMatches(skuTrim, { limit: 50 });
    const skuNorm = normalizeSkuForMatch(skuTrim);
    const match = result.matches.find(
      (row) =>
        normalizeSkuForMatch(row.sku) === skuNorm &&
        countryMatches(row.warehouse_name, countryTrim),
    );
    if (match) {
      return {
        sku: match.sku,
        country: match.warehouse_name,
        product_name: null,
        available_quantity: Number(match.quantity) || 0,
        po_quantity: 0,
        movement_quantity: 0,
        found: true,
      };
    }
  } catch {
    /* no inventory */
  }

  return empty;
}

export async function appendMovementLog(params: {
  movementId: string;
  actorEmail: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remarks?: string | null;
}) {
  const supabase = createSupabaseClient();
  await supabase.from("movement_request_logs").insert({
    movement_id: params.movementId,
    actor_email: params.actorEmail,
    action: params.action,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    remarks: params.remarks ?? null,
  });
}

export async function getMovementLogs(movementId: string) {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("movement_request_logs")
    .select("*")
    .eq("movement_id", movementId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function mapMovementRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    movement_number: String(row.movement_number ?? ""),
    movement_head: row.movement_head,
    created_by_email: String(row.created_by_email ?? ""),
    from_sku: String(row.from_sku ?? ""),
    from_country: String(row.from_country ?? ""),
    from_product_name: row.from_product_name == null ? null : String(row.from_product_name),
    to_sku: String(row.to_sku ?? ""),
    to_country: String(row.to_country ?? ""),
    to_product_name: row.to_product_name == null ? null : String(row.to_product_name),
    quantity: Number(row.quantity) || 0,
    shipping_mode: row.shipping_mode,
    status: row.status,
    approver_email: row.approver_email == null ? null : String(row.approver_email),
    approver_action_at: row.approver_action_at == null ? null : String(row.approver_action_at),
    approver_remarks: row.approver_remarks == null ? null : String(row.approver_remarks),
    procurement_email: row.procurement_email == null ? null : String(row.procurement_email),
    procurement_action_at:
      row.procurement_action_at == null ? null : String(row.procurement_action_at),
    procurement_remarks:
      row.procurement_remarks == null ? null : String(row.procurement_remarks),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
