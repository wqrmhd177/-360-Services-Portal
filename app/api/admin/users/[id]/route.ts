import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import {
  isPortalDepartment,
  isPortalRole,
  isProductAvailabilityRole,
  type MainTabAccess,
  type PortalDepartment,
  type PortalRole,
  type ProductAvailabilityRole,
  type UserPermissions,
} from "@/lib/permissions";
import { isAssignableRole, type UserRole } from "@/lib/simpleAuth";

function validatePermissions(body: unknown): UserPermissions | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;

  const portal_role =
    typeof raw.portal_role === "string" && isPortalRole(raw.portal_role)
      ? (raw.portal_role as PortalRole)
      : "manager";

  const department =
    raw.department === null
      ? null
      : typeof raw.department === "string" && isPortalDepartment(raw.department)
        ? (raw.department as PortalDepartment)
        : null;

  const product_availability =
    raw.product_availability === null
      ? null
      : typeof raw.product_availability === "string" &&
          isProductAvailabilityRole(raw.product_availability)
        ? (raw.product_availability as ProductAvailabilityRole)
        : null;

  const product_listing = raw.product_listing === true;
  const operations = raw.operations === true;

  let tabs: Partial<MainTabAccess> | undefined;
  if (raw.tabs && typeof raw.tabs === "object") {
    const tabRaw = raw.tabs as Record<string, unknown>;
    tabs = {
      home: tabRaw.home !== false,
      operations: tabRaw.operations === true,
      product_availability: tabRaw.product_availability === true,
      product_listing: tabRaw.product_listing === true,
      admin_users: tabRaw.admin_users === true,
    };
  }

  return {
    portal_role,
    department,
    tabs,
    product_availability,
    product_listing,
    operations,
    zambeel360: [],
  };
}

function validateRole(role: unknown): UserRole | null {
  if (typeof role !== "string") return null;
  if (role === "admin") return "admin";
  if (isAssignableRole(role)) return role;
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = getPortalSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    permissions?: unknown;
    role?: unknown;
  } | null;

  const permissions = validatePermissions(body?.permissions);
  if (!permissions) {
    return NextResponse.json({ error: "Invalid permissions payload" }, { status: 400 });
  }

  let roleToSave: UserRole | undefined;
  if (body?.role !== undefined) {
    const validated = validateRole(body.role);
    if (validated === null) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    roleToSave = validated;
  }

  const update: {
    permissions: UserPermissions;
    updated_at: string;
    role?: UserRole;
  } = {
    permissions,
    updated_at: new Date().toISOString(),
  };

  if (roleToSave) {
    update.role = roleToSave;
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", params.id)
    .select("id,email,full_name,role,team,permissions")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
