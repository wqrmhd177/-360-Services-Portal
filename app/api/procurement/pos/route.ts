import { NextResponse } from "next/server";
import { getProcurementPOs } from "@/lib/procurementPos";

/** Single source of truth for procurement PO list (same as Purchase Orders page). */
export async function GET() {
  try {
    const pos = await getProcurementPOs();
    return NextResponse.json({ pos });
  } catch (e) {
    console.error("[api/procurement/pos] getProcurementPOs failed:", e);
    return NextResponse.json({ pos: [] });
  }
}
