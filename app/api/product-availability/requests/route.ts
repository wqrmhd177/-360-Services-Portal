import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  getEffectiveProductAvailabilityRole,
  parsePermissions,
} from "@/lib/permissions";
import {
  cancelProductAvailabilityRequest,
  createBulkDraftRequests,
  createProductAvailabilityRequest,
  fetchAllProductAvailabilityData,
  requestAlternativeSearch,
  submitDraftRequest,
  submitProductAvailabilityResponse,
  type CreateProductAvailabilityInput,
} from "@/lib/productAvailabilityHelpers";

function sessionContext() {
  const session = getPortalSession();
  if (!session?.email) return null;
  const permissions = parsePermissions(session.permissions);
  const userRole = getEffectiveProductAvailabilityRole({
    role: session.role,
    isAdmin: session.isAdmin,
    permissions,
  });
  return { session, userRole, db: createSupabaseServiceClient() };
}

export async function GET() {
  const ctx = sessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const requests = await fetchAllProductAvailabilityData({
      userRole: ctx.userRole,
      userFriendlyId: ctx.session.email,
      supabaseClient: ctx.db,
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch product availability requests:", error);
    return NextResponse.json(
      { error: "Failed to load product availability requests" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const ctx = sessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    switch (action) {
      case "create": {
        const created = await createProductAvailabilityRequest(
          body.input as CreateProductAvailabilityInput,
        );
        return NextResponse.json({ data: created });
      }
      case "cancel": {
        await cancelProductAvailabilityRequest(String(body.requestId));
        return NextResponse.json({ ok: true });
      }
      case "alternative_search": {
        await requestAlternativeSearch(String(body.requestId), String(body.remarks ?? ""));
        return NextResponse.json({ ok: true });
      }
      case "submit_response": {
        await submitProductAvailabilityResponse(body.input);
        return NextResponse.json({ ok: true });
      }
      case "bulk_drafts": {
        const result = await createBulkDraftRequests(
          body.rows,
          ctx.session.email,
          ctx.userRole,
        );
        return NextResponse.json({ data: result });
      }
      case "submit_draft": {
        await submitDraftRequest(String(body.requestId), body.imageUrls ?? []);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("product-availability POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 },
    );
  }
}
