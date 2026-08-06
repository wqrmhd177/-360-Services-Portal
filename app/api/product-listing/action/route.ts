import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { fetchAllSuppliers } from "@/lib/productListing/supplierHelpers";
import { createPriceHistoryEntry } from "@/lib/productListing/priceHistoryHelpers";
import { createVariantStatusChangeRequest } from "@/lib/productListing/variantStatusChangeHelpers";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const suppliers = await fetchAllSuppliers();
    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error("product-listing suppliers:", error);
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "save_variant_changes") {
      const productId = Number(body.productId);
      const variants = (body.variants ?? []) as Array<{
        variant_id: number;
        price: number;
        active: boolean;
        newPrice: number;
        newActive: boolean;
      }>;
      const email = session.email;

      for (const variant of variants) {
        if (variant.newPrice !== variant.price) {
          await createPriceHistoryEntry(
            productId,
            variant.variant_id,
            variant.price,
            variant.newPrice,
            email,
          );
        }
        if (variant.newActive !== variant.active) {
          await createVariantStatusChangeRequest(
            productId,
            variant.variant_id,
            variant.active,
            variant.newActive,
            email,
            "variant",
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("product-listing action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 },
    );
  }
}
