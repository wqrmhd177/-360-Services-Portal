import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { requireWriteAccess } from "@/lib/accessControl";
import { validatePoHeaderFields, validatePoProductLine } from "@/lib/poValidation";
import type { PoProduct } from "@/types/workflows";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(
    session,
    ["procurement"],
    "Forbidden - Procurement role required to edit POs"
  );
  if (denied) return denied;

  try {
    const body = await request.json();
    const supplier_name = String(body.supplier_name ?? "").trim();
    const supplier_location = String(body.supplier_location ?? "").trim();
    const delivery_partner = String(body.delivery_partner ?? "").trim();
    const delivery_partner_tracking_id = String(body.delivery_partner_tracking_id ?? "").trim();
    const remarks = body.remarks != null ? String(body.remarks) : null;
    const po_type = String(body.po_type ?? "internal");
    const products = body.products as PoProduct[] | undefined;

    const headerError = validatePoHeaderFields({
      supplier_name,
      supplier_location,
      delivery_partner,
    });
    if (headerError) {
      return NextResponse.json({ error: headerError }, { status: 400 });
    }

    if (products?.length) {
      for (let i = 0; i < products.length; i++) {
        const lineError = validatePoProductLine(
          {
            productName: products[i].productName,
            quantity: Number(products[i].quantity),
            productCostPerUnit: products[i].productCostPerUnit,
            freightCostPerUnit: products[i].freightCostPerUnit,
          },
          `Line ${i + 1}`
        );
        if (lineError) {
          return NextResponse.json({ error: lineError }, { status: 400 });
        }
      }
    }

    const normalizedProducts = products?.map((p) => {
      const quantity = Number(p.quantity) || 0;
      const productCostPerUnit =
        p.productCostPerUnit != null ? Number(p.productCostPerUnit) : undefined;
      const freightCostPerUnit =
        p.freightCostPerUnit != null ? Number(p.freightCostPerUnit) : undefined;
      return {
        productName: p.productName.trim(),
        skuCode: p.skuCode?.trim() || undefined,
        quantity,
        rate: p.rate != null ? Number(p.rate) : undefined,
        amount: p.amount != null ? Number(p.amount) : undefined,
        productCostPerUnit,
        productCostAmount:
          productCostPerUnit != null ? productCostPerUnit * quantity : undefined,
        freightCostPerUnit,
        freightCostAmount:
          freightCostPerUnit != null ? freightCostPerUnit * quantity : undefined,
      };
    });

    const supabase = createSupabaseClient();
    const updates: Record<string, unknown> = {
      supplier_name,
      supplier_location,
      delivery_partner,
      delivery_partner_tracking_id,
      remarks,
      po_type,
      updated_at: new Date().toISOString(),
    };
    if (normalizedProducts) {
      updates.products = normalizedProducts;
    }

    const { error } = await supabase.from("po").update(updates).eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PO update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
