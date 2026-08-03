import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  getEffectiveProductAvailabilityRole,
  parsePermissions,
} from "@/lib/permissions";
import { fetchAllProductAvailabilityData } from "@/lib/productAvailabilityHelpers";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const permissions = parsePermissions(session.permissions);
    const userRole = getEffectiveProductAvailabilityRole({
      role: session.role,
      isAdmin: session.isAdmin,
      permissions,
    });

    const db = createSupabaseServiceClient();
    const requests = await fetchAllProductAvailabilityData({
      userRole,
      userFriendlyId: session.email,
      supabaseClient: db,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to fetch product availability requests:", error);
    return NextResponse.json(
      { error: "Failed to load product availability requests" },
      { status: 500 }
    );
  }
}
