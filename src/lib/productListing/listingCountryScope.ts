import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  countryValueInAllowedScope,
  type AllowedCountriesConfig,
} from "@/lib/portalCountryScope";
import type { PlGroupedProduct, PlSupplier } from "@/lib/productListing/types";
import type { MergedProductUpdateRequest } from "@/lib/productListing/productUpdatesServer";

export function filterSuppliersForCountryScope(
  suppliers: PlSupplier[],
  scope: AllowedCountriesConfig,
): PlSupplier[] {
  if (scope === "all") return suppliers;
  return suppliers.filter((s) => countryValueInAllowedScope(s.country, scope));
}

export function filterProductsForCountryScope(
  products: PlGroupedProduct[],
  suppliers: PlSupplier[],
  scope: AllowedCountriesConfig,
): PlGroupedProduct[] {
  if (scope === "all") return products;
  const allowedSupplierCodes = new Set(
    filterSuppliersForCountryScope(suppliers, scope).map((s) => s.supplier_code),
  );
  return products.filter((p) => allowedSupplierCodes.has(p.fk_owned_by));
}

export function assertListingCountryAllowed(
  country: string | null | undefined,
  scope: AllowedCountriesConfig,
): void {
  if (scope === "all") return;
  if (!countryValueInAllowedScope(country, scope)) {
    throw new Error("You are not allowed to use this country for product listing.");
  }
}

export async function filterMergedProductUpdatesForCountryScope(
  requests: MergedProductUpdateRequest[],
  scope: AllowedCountriesConfig,
): Promise<MergedProductUpdateRequest[]> {
  if (scope === "all" || requests.length === 0) return requests;

  const productIds = [...new Set(requests.map((r) => r.product_id))];
  const supabase = createSupabaseServiceClient();

  const { data: products } = await supabase
    .from("pl_products")
    .select("product_id, fk_owned_by")
    .in("product_id", productIds);

  const ownerByProduct = new Map<number, string>();
  for (const row of products ?? []) {
    const pid = Number((row as { product_id: number }).product_id);
    const owner = String((row as { fk_owned_by: string }).fk_owned_by ?? "").trim();
    if (pid && owner) ownerByProduct.set(pid, owner);
  }

  const ownerCodes = [...new Set(ownerByProduct.values())];
  if (ownerCodes.length === 0) return [];

  const { data: suppliers } = await supabase
    .from("pl_suppliers")
    .select("supplier_code, country")
    .in("supplier_code", ownerCodes);

  const countryBySupplier = new Map<string, string | null>();
  for (const row of suppliers ?? []) {
    const code = String((row as { supplier_code: string }).supplier_code ?? "").trim();
    countryBySupplier.set(code, (row as { country: string | null }).country ?? null);
  }

  return requests.filter((req) => {
    const owner = ownerByProduct.get(req.product_id);
    if (!owner) return false;
    return countryValueInAllowedScope(countryBySupplier.get(owner), scope);
  });
}

export async function supplierCountryForCode(
  supplierCode: string,
): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("pl_suppliers")
    .select("country")
    .eq("supplier_code", supplierCode)
    .maybeSingle();
  return (data as { country?: string | null } | null)?.country ?? null;
}

export async function productAllowedForCountryScope(
  productId: number,
  scope: AllowedCountriesConfig,
): Promise<boolean> {
  if (scope === "all") return true;
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("pl_products")
    .select("fk_owned_by")
    .eq("product_id", productId)
    .maybeSingle();
  const owner = String((data as { fk_owned_by?: string } | null)?.fk_owned_by ?? "").trim();
  if (!owner) return false;
  const country = await supplierCountryForCode(owner);
  return countryValueInAllowedScope(country, scope);
}
