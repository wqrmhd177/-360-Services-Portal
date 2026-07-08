import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import {
  isProductAvailabilityRole,
  isZambeelDepartment,
  type UserPermissions,
  type ZambeelDepartment,
} from "@/lib/permissions";
import { isAssignableRole, type UserRole } from "@/lib/simpleAuth";

function validatePermissions(body: unknown): UserPermissions | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;

  const zambeel360 = Array.isArray(raw.zambeel360)
    ? raw.zambeel360.filter((v): v is ZambeelDepartment => typeof v === "string" && isZambeelDepartment(v))
    : [];

  const product_availability =
    raw.product_availability === null
      ? null
      : typeof raw.product_availability === "string" &&
          isProductAvailabilityRole(raw.product_availability)
        ? raw.product_availability
        : null;

  const product_listing = raw.product_listing === true;
  const operations = raw.operations === true;

  return {
    zambeel360,
    product_availability,
    product_listing,
    operations,
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
  { params }: { params: { id: string } }
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

  if (roleToSave !== undefined) {
    update.role = roleToSave;
  }

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", params.id)
      .select("id, email, full_name, role, permissions")
      .single();

    if (error) {
      console.error("Failed to update user permissions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("User permissions update error:", error);
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  }
}
