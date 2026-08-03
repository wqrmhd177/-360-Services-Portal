import type { UserRole } from "./simpleAuth";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserPermissions {
  zambeel360?: ZambeelDepartment[];
  product_availability?: ProductAvailabilityRole | null;
  product_listing?: boolean;
  operations?: boolean;
}

const ZAMBEEL_ROLES = ["growth", "approver", "procurement", "finance"] as const;
const PA_ROLES = ["agent", "purchaser", "manager"] as const;

export type ZambeelDepartment = (typeof ZAMBEEL_ROLES)[number];
export type ProductAvailabilityRole = (typeof PA_ROLES)[number];

export function isZambeelDepartment(value: string): value is ZambeelDepartment {
  return (ZAMBEEL_ROLES as readonly string[]).includes(value);
}

export function isProductAvailabilityRole(value: string): value is ProductAvailabilityRole {
  return (PA_ROLES as readonly string[]).includes(value);
}

export function parsePermissions(raw: unknown): UserPermissions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const zambeel360 = Array.isArray(obj.zambeel360)
    ? obj.zambeel360.filter((v): v is ZambeelDepartment => typeof v === "string" && isZambeelDepartment(v))
    : undefined;
  const product_availability =
    obj.product_availability === null
      ? null
      : typeof obj.product_availability === "string" &&
          isProductAvailabilityRole(obj.product_availability)
        ? obj.product_availability
        : undefined;
  const product_listing =
    typeof obj.product_listing === "boolean" ? obj.product_listing : undefined;
  const operations = typeof obj.operations === "boolean" ? obj.operations : undefined;

  if (
    zambeel360 === undefined &&
    product_availability === undefined &&
    product_listing === undefined &&
    operations === undefined
  ) {
    return undefined;
  }

  return {
    zambeel360,
    product_availability,
    product_listing,
    operations,
  };
}

export function deriveEffectivePermissions(input: {
  role?: UserRole | string | null;
  isAdmin?: boolean;
  permissions?: UserPermissions;
}) {
  const { role, isAdmin, permissions } = input;

  if (isAdmin) {
    return {
      zambeelPerms: [...ZAMBEEL_ROLES] as ZambeelDepartment[],
      paRole: "manager" as ProductAvailabilityRole | null,
      productListing: true,
      operations: true,
    };
  }

  const zambeelPerms: ZambeelDepartment[] =
    permissions?.zambeel360 ??
    (role && isZambeelDepartment(role) ? [role] : []);

  const explicitPa = permissions?.product_availability;
  const paRole: ProductAvailabilityRole | null =
    typeof explicitPa === "string" && isProductAvailabilityRole(explicitPa)
      ? explicitPa
      : role && isProductAvailabilityRole(role)
        ? role
        : "agent";

  const productListing = permissions?.product_listing ?? false;
  const operations = permissions?.operations ?? false;

  return { zambeelPerms, paRole, productListing, operations };
}

export function formatZambeelPerms(perms: string[] | undefined): string {
  if (!perms?.length) return "None";
  return perms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
}

export function formatPaRole(role: string | null | undefined): string {
  if (!role) return "None";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Roles that see all requests (admin oversight). */
export function isProductAvailabilityAdminViewer(role: string | null | undefined): boolean {
  return (role ?? "").toLowerCase() === "admin";
}

/** How Product Availability list queries are scoped for a viewer role. */
export type ProductAvailabilityDataScope = "all" | "own_requests" | "assigned" | "market";

export function getProductAvailabilityDataScope(
  role: string | null | undefined
): ProductAvailabilityDataScope {
  const r = (role ?? "").toLowerCase();
  if (r === "admin") return "all";
  if (r === "purchaser") return "assigned";
  if (r === "manager") return "market";
  // agent, growth, and any other requester — only their own submissions
  return "own_requests";
}

export function normalizeProductAvailabilityUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

/** Resolve every value that may appear in requested_by_user_id for this portal user. */
export async function resolveProductAvailabilityOwnerIds(
  userEmail: string,
  db: SupabaseClient
): Promise<string[]> {
  const normalized = normalizeProductAvailabilityUserId(userEmail);
  const ids = new Set<string>([normalized, userEmail.trim()]);

  const { data: profile } = await db
    .from("profiles")
    .select("id, email")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id) ids.add(String(profile.id));
  if (profile?.email) {
    ids.add(profile.email.trim());
    ids.add(normalizeProductAvailabilityUserId(profile.email));
  }

  return Array.from(ids).filter(Boolean);
}

export function buildRequestedByOwnerOrFilter(ownerIds: string[]): string | null {
  const unique = Array.from(new Set(ownerIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return null;
  return unique.map((id) => `requested_by_user_id.ilike.${id}`).join(",");
}

export function getEffectiveProductAvailabilityRole(input: {
  role?: UserRole | string | null;
  isAdmin?: boolean;
  permissions?: UserPermissions;
}): string {
  if (input.isAdmin) return "admin";
  const { paRole } = deriveEffectivePermissions(input);
  return paRole ?? "agent";
}

export const ZAMBEEL_DEPARTMENT_OPTIONS: { value: ZambeelDepartment; label: string }[] = [
  { value: "growth", label: "Growth" },
  { value: "approver", label: "Approver" },
  { value: "finance", label: "Finance" },
  { value: "procurement", label: "Procurement" },
];

export const PA_ROLE_OPTIONS: { value: ProductAvailabilityRole | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "agent", label: "Agent" },
  { value: "purchaser", label: "Purchaser" },
  { value: "manager", label: "Manager" },
];
