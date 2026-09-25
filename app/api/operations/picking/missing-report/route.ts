import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { getAllPickingProducts } from "@/lib/operations/picking";
import { buildMissingPicturesReportHtml } from "@/lib/operations/pickingDocuments";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getAllPickingProducts();
  const html = buildMissingPicturesReportHtml(rows);

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
