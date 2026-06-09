import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { buildPoProductsFromPr } from "@/lib/poProductCosts";
import type { ProcurementResponseMap } from "@/lib/procurementImages";
import type { PoProduct } from "@/types/workflows";

const VIEW_ROLES = new Set(["growth", "approver", "procurement", "finance", "admin"]);

function canViewPo(
  session: { email: string; role?: string; isAdmin?: boolean },
  po: { pr_id: string | null; created_by_email?: string },
  pr: { created_by_email?: string } | null
): boolean {
  if (session.isAdmin) return true;
  if (!session.role || !VIEW_ROLES.has(session.role)) return false;

  if (session.role === "growth") {
    if (pr?.created_by_email) {
      return pr.created_by_email === session.email;
    }
    return po.created_by_email === session.email;
  }

  return true;
}

function mergeProductCosts(stored: PoProduct, resolved: PoProduct): PoProduct {
  const quantity = stored.quantity || resolved.quantity || 0;
  const productCostPerUnit = stored.productCostPerUnit ?? resolved.productCostPerUnit;
  const freightCostPerUnit = stored.freightCostPerUnit ?? resolved.freightCostPerUnit;

  return {
    ...stored,
    productCostPerUnit,
    freightCostPerUnit,
    productCostAmount:
      stored.productCostAmount ??
      (productCostPerUnit != null ? productCostPerUnit * quantity : undefined),
    freightCostAmount:
      stored.freightCostAmount ??
      (freightCostPerUnit != null ? freightCostPerUnit * quantity : undefined),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data: po, error: poError } = await supabase
      .from("po")
      .select("id, pr_id, created_by_email, products")
      .eq("id", params.id)
      .maybeSingle();

    if (poError || !po) {
      return NextResponse.json({ error: "PO not found" }, { status: 404 });
    }

    let pr: {
      created_by_email?: string;
      from_qr_id?: string | null;
      products?: unknown;
      product_name?: string;
      sku_code?: string;
      quantity?: number;
      rate?: number;
    } | null = null;

    if (po.pr_id) {
      const { data: prRow } = await supabase
        .from("pr")
        .select(
          "created_by_email, from_qr_id, products, product_name, sku_code, quantity, rate"
        )
        .eq("id", po.pr_id)
        .maybeSingle();
      pr = prRow;
    }

    if (!canViewPo(session, po, pr)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storedProducts: PoProduct[] =
      po.products && Array.isArray(po.products) && po.products.length > 0 ? po.products : [];

    let qr: {
      purchase_details?: Array<{ productName?: string }> | null;
      procurement_response?: ProcurementResponseMap | null;
    } | null = null;

    if (pr?.from_qr_id) {
      const { data: qrRow } = await supabase
        .from("qr")
        .select("purchase_details, procurement_response")
        .eq("id", pr.from_qr_id)
        .maybeSingle();
      if (qrRow) {
        qr = {
          purchase_details: qrRow.purchase_details as Array<{ productName?: string }> | null,
          procurement_response: qrRow.procurement_response as ProcurementResponseMap | null,
        };
      }
    }

    const resolvedProducts = buildPoProductsFromPr(
      pr?.products as Parameters<typeof buildPoProductsFromPr>[0],
      pr
        ? {
            product_name: pr.product_name,
            sku_code: pr.sku_code,
            quantity: pr.quantity,
            rate: pr.rate,
          }
        : undefined,
      qr
    );

    const products =
      storedProducts.length > 0
        ? storedProducts.map((stored, index) =>
            mergeProductCosts(stored, resolvedProducts[index] ?? stored)
          )
        : resolvedProducts;

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Failed to load supplier costs for PO:", error);
    return NextResponse.json({ error: "Failed to load supplier costs" }, { status: 500 });
  }
}
