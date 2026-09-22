import { NextRequest, NextResponse } from "next/server";
import { isPortalAuthenticated } from "@/lib/operations/apiAuth";
import { hasServiceRoleKey } from "@/lib/operations/syncAll";
import {
  getPickingImageSyncStats,
  syncPickingImagesUntil,
} from "@/lib/operations/syncPicking";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getPickingImageSyncStats();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not load picture status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isPortalAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      maxMs?: number;
      concurrency?: number;
      pageSize?: number;
      skuGte?: string;
      skuLt?: string;
    };
    const result = await syncPickingImagesUntil({
      maxMs: Math.min(120_000, Math.max(15_000, body.maxMs ?? 50_000)),
      concurrency: Math.min(16, Math.max(2, body.concurrency ?? 8)),
      pageSize: Math.min(200, Math.max(20, body.pageSize ?? 100)),
      skuGte: body.skuGte,
      skuLt: body.skuLt,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Picture sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
