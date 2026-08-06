import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  fetchProductsWithVariants,
  deleteProduct,
  updateProductStatus,
  generateProductId,
} from "@/lib/productListing/productHelpers";

export async function GET(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const db = createSupabaseServiceClient();
    const products = await fetchProductsWithVariants(
      { status: status as never, search: search ?? undefined },
      db,
    );
    return NextResponse.json({ products });
  } catch (error) {
    console.error("product-listing products GET:", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const productId = Number(body.productId);
    const status = String(body.status ?? "");
    if (!productId || !status) {
      return NextResponse.json({ error: "productId and status required" }, { status: 400 });
    }
    const db = createSupabaseServiceClient();
    const ok = await updateProductStatus(productId, status as never, db);
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("product-listing products PATCH:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = Number(searchParams.get("productId"));
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }
    const db = createSupabaseServiceClient();
    const ok = await deleteProduct(productId, db);
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("product-listing products DELETE:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = createSupabaseServiceClient();
    const productId = await generateProductId();

    const { error: prodErr } = await db.from("pl_products").insert([
      {
        product_id: productId,
        product_title: body.title,
        fk_owned_by: body.supplierId,
        image: body.imageUrls?.length > 0 ? body.imageUrls : null,
        brand_name: body.brand || null,
        material: body.material || null,
        description: body.description || null,
        package_includes: body.packageIncludes?.length > 0 ? body.packageIncludes : null,
        has_variants: body.hasVariants,
        options: body.hasVariants ? body.options : null,
        status: "pending",
      },
    ]);

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    if (body.hasVariants && body.variantRows?.length > 0) {
      const variantInserts = body.variantRows.map(
        (r: {
          combination: Record<string, string>;
          price: string;
          stock: string;
          sku: string;
          images: string[];
        }) => ({
          product_id: productId,
          option_values: r.combination,
          price: parseFloat(r.price) || 0,
          stock: parseInt(r.stock, 10) || 0,
          sku: r.sku || null,
          image: r.images?.length > 0 ? r.images : null,
          active: true,
        }),
      );
      const { error: varErr } = await db.from("pl_product_variants").insert(variantInserts);
      if (varErr) {
        await db.from("pl_products").delete().eq("product_id", productId);
        return NextResponse.json({ error: varErr.message }, { status: 500 });
      }
    } else {
      await db.from("pl_product_variants").insert([
        {
          product_id: productId,
          option_values: null,
          price: parseFloat(body.singlePrice) || 0,
          stock: parseInt(body.singleStock, 10) || 0,
          sku: body.singleSku || null,
          active: true,
        },
      ]);
    }

    return NextResponse.json({ productId });
  } catch (error) {
    console.error("product-listing products POST:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
