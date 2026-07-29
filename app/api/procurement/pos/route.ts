import { NextResponse } from "next/server";
import { getProcurementPOs } from "@/lib/procurementPos";

/** Single source of truth for procurement PO list (same as Purchase Orders page). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("page_size") ?? "100", 10) || 100));
    const pos = await getProcurementPOs(pageSize);
    return NextResponse.json({ pos, page, page_size: pageSize });
  } catch (e) {
    console.error("[api/procurement/pos] getProcurementPOs failed:", e);
    return NextResponse.json({ pos: [] });
  }
}
