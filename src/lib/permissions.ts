import type { UserRole } from "./simpleAuth";

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

  const paRole: ProductAvailabilityRole | null =
    permissions?.product_availability !== undefined
      ? permissions.product_availability
      : role && isProductAvailabilityRole(role)
        ? role
        : null;

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
