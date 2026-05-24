import { createSupabaseClient } from "@/lib/supabaseClient";
import type { Po } from "@/types/workflows";

/** Fetches all POs enriched with product names and creator (same logic as dashboard and API). */
export async function getProcurementPOs(): Promise<Po[]> {
  try {
    const supabase = createSupabaseClient();

  const [
    { data: allPos, error: poError },
    { data: allPrs },
    { data: profiles }
  ] = await Promise.all([
    supabase
      .from("po")
      .select("id, po_number, pr_id, supplier_name, delivery_partner, status, created_at, created_by_email")
      .order("created_at", { ascending: false }),
    supabase
      .from("pr")
      .select("id, product_name, products, created_by_email"),
    supabase
      .from("profiles")
      .select("email, full_name")
  ]);

  if (poError) {
    console.error("[getProcurementPOs] Supabase po query error:", poError.message, poError.code);
    return [];
  }

  const emailToNameMap = new Map(
    (profiles ?? []).map((p: { email: string; full_name?: string }) => [p.email, p.full_name])
  );
  const prMap = new Map((allPrs ?? []).map((pr: any) => [pr.id, pr]));

  const enrichedPos = (allPos ?? []).map((po: any) => {
    const pr = po.pr_id ? prMap.get(po.pr_id) : null;
    let productNames = "-";
    let creatorName = "-";

    if (pr) {
      if (pr.products && Array.isArray(pr.products) && pr.products.length > 0) {
        productNames = pr.products.map((p: any) => p.productName).join(", ");
      } else if (pr.product_name) {
        productNames = pr.product_name;
      }
      creatorName = emailToNameMap.get(pr.created_by_email) || pr.created_by_email || "-";
    } else {
      const products = po.products;
      if (products && Array.isArray(products) && products.length > 0) {
        productNames = products.map((p: any) => p.productName || p.product_name).join(", ");
      }
      creatorName = emailToNameMap.get(po.created_by_email) || po.created_by_email || "-";
    }

    return {
      ...po,
      product_names: productNames,
      creator_name: creatorName
    };
  });

  const result = enrichedPos as Po[];
  if (result.length === 0) {
    console.warn("[getProcurementPOs] Supabase returned 0 POs (table may be empty or RLS blocking).");
  }
  return result;
  } catch (err) {
    console.error("[getProcurementPOs] error:", err);
    return [];
  }
}
