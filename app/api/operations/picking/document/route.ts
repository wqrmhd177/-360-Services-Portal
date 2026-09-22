import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { lookupPickingProducts } from "@/lib/operations/picking";
import { withPickingPictureUrl } from "@/lib/operations/pickingUploads";
import {
  buildPickingDocumentHtml,
  type PickingDocLine,
  type PickingDocType,
} from "@/lib/operations/pickingDocuments";

function formatDocDate(date = new Date()): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function parseOptionalQty(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      type?: string;
      partTitle?: string;
      comments?: string;
      lines?: Array<{
        sku?: string;
        quantity?: number;
        good_qty?: number | null;
        bad_qty?: number | null;
      }>;
    };
    const type = body.type === "awb" ? "awb" : body.type === "grn" ? "grn" : null;
    if (!type) {
      return NextResponse.json({ error: "type must be grn or awb." }, { status: 400 });
    }
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const wanted = rawLines
      .map((line) => ({
        sku: String(line.sku ?? "").trim(),
        quantity: Number(line.quantity ?? 0),
        good_qty: parseOptionalQty(line.good_qty),
        bad_qty: parseOptionalQty(line.bad_qty),
      }))
      .filter((line) => line.sku && Number.isFinite(line.quantity) && line.quantity > 0);
    if (wanted.length === 0) {
      return NextResponse.json(
        { error: "Add at least one SKU with a quantity greater than 0." },
        { status: 400 },
      );
    }

    const origin = request.nextUrl.origin;
    const products = await lookupPickingProducts(wanted.map((line) => line.sku));
    const bySku = new Map(products.map((row) => [row.sku.toLowerCase(), row]));
    const lines: PickingDocLine[] = [];
    for (const line of wanted) {
      const product = bySku.get(line.sku.toLowerCase());
      if (!product) {
        lines.push({
          sku: line.sku,
          product_name: "Not Available",
          image_url: null,
          quantity: line.quantity,
          good_qty: line.good_qty,
          bad_qty: line.bad_qty,
        });
        continue;
      }
      const pictured = withPickingPictureUrl(product, origin);
      lines.push({
        sku: pictured.sku,
        product_name: pictured.product_name?.trim() || "Not Available",
        image_url: pictured.image_url,
        quantity: line.quantity,
        good_qty: line.good_qty,
        bad_qty: line.bad_qty,
      });
    }

    const dateLabel = formatDocDate();
    const html = buildPickingDocumentHtml({
      type: type as PickingDocType,
      lines,
      dateLabel,
      comments: body.comments,
    });
    return NextResponse.json({ ok: true, html, dateLabel, lineCount: lines.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not build document";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
