import type { SignupTeam, UserRole } from "./simpleAuth";
import { formatSignupTeamLabel, isSignupTeam } from "./simpleAuth";
import type { SupabaseClient } from "@supabase/supabase-js";

const ZAMBEEL_ROLES = ["growth", "approver", "procurement", "finance"] as const;
const PA_ROLES = ["agent", "purchaser", "manager"] as const;
const PORTAL_ROLES = ["agent", "manager", "admin"] as const;
const PORTAL_DEPARTMENTS = [
  "growth",
  "finance",
  "operations",
  "strategy",
  "partner_store",
] as const;
const MAIN_TABS = [
  "home",
  "operations",
  "product_availability",
  "product_listing",
  "admin_users",
] as const;

export type ZambeelDepartment = (typeof ZAMBEEL_ROLES)[number];
export type ProductAvailabilityRole = (typeof PA_ROLES)[number];
export type PortalRole = (typeof PORTAL_ROLES)[number];
export type PortalDepartment = (typeof PORTAL_DEPARTMENTS)[number];
export type MainTab = (typeof MAIN_TABS)[number];

export type MainTabAccess = Record<MainTab, boolean>;

export interface UserPermissions {
  zambeel360?: ZambeelDepartment[];
  product_availability?: ProductAvailabilityRole | null;
  product_listing?: boolean;
  operations?: boolean;
  portal_role?: PortalRole;
  department?: PortalDepartment | null;
  tabs?: Partial<MainTabAccess>;
}

export function isZambeelDepartment(value: string): value is ZambeelDepartment {
  return (ZAMBEEL_ROLES as readonly string[]).includes(value);
}

export function isProductAvailabilityRole(value: string): value is ProductAvailabilityRole {
  return (PA_ROLES as readonly string[]).includes(value);
}

export function isPortalRole(value: string): value is PortalRole {
  return (PORTAL_ROLES as readonly string[]).includes(value);
}

export function isPortalDepartment(value: string): value is PortalDepartment {
  return (PORTAL_DEPARTMENTS as readonly string[]).includes(value);
}

function teamToDepartment(team: string | null | undefined): PortalDepartment | null {
  if (!team) return null;
  if (team === "listing_team") return "partner_store";
  return isPortalDepartment(team) ? team : null;
}

function resolvePaRole(
  permissions: UserPermissions | undefined,
  role: string | null | undefined,
): ProductAvailabilityRole | null {
  const explicitPa = permissions?.product_availability;
  if (explicitPa === null) return null;
  if (typeof explicitPa === "string" && isProductAvailabilityRole(explicitPa)) {
    return explicitPa;
  }
  if (role && isProductAvailabilityRole(role)) return role;
  return null;
}

function resolveLegacyTabs(input: {
  role?: string | null;
  permissions?: UserPermissions;
}): MainTabAccess {
  const { role, permissions } = input;
  const paRole = resolvePaRole(permissions, role);
  const hasExplicitTabs = Boolean(permissions?.tabs && typeof permissions.tabs === "object");

  if (hasExplicitTabs) {
    return {
      home: permissions?.tabs?.home ?? true,
      operations: permissions?.tabs?.operations ?? false,
      product_availability: permissions?.tabs?.product_availability ?? false,
      product_listing: permissions?.tabs?.product_listing ?? false,
      admin_users: permissions?.tabs?.admin_users ?? false,
    };
  }

  return {
    home: true,
    operations: permissions?.operations === true,
    product_availability: paRole !== null,
    product_listing: permissions?.product_listing === true,
    admin_users: false,
  };
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

  const portal_role =
    typeof obj.portal_role === "string" && isPortalRole(obj.portal_role)
      ? obj.portal_role
      : undefined;

  const department =
    obj.department === null
      ? null
      : typeof obj.department === "string" && isPortalDepartment(obj.department)
        ? obj.department
        : undefined;

  let tabs: Partial<MainTabAccess> | undefined;
  if (obj.tabs && typeof obj.tabs === "object") {
    const tabObj = obj.tabs as Record<string, unknown>;
    tabs = {};
    for (const tab of MAIN_TABS) {
      if (typeof tabObj[tab] === "boolean") {
        tabs[tab] = tabObj[tab] as boolean;
      }
    }
  }

  if (
    zambeel360 === undefined &&
    product_availability === undefined &&
    product_listing === undefined &&
    operations === undefined &&
    portal_role === undefined &&
    department === undefined &&
    tabs === undefined
  ) {
    return undefined;
  }

  return {
    zambeel360,
    product_availability,
    product_listing,
    operations,
    portal_role,
    department,
    tabs,
  };
}

export function deriveEffectivePermissions(input: {
  role?: UserRole | string | null;
  isAdmin?: boolean;
  permissions?: UserPermissions;
  team?: SignupTeam | string | null;
}) {
  const { role, isAdmin, permissions, team } = input;

  if (isAdmin) {
    return {
      portalRole: "admin" as PortalRole,
      department: (permissions?.department ?? teamToDepartment(team) ?? null) as PortalDepartment | null,
      tabs: {
        home: true,
        operations: true,
        product_availability: true,
        product_listing: true,
        admin_users: true,
      } satisfies MainTabAccess,
      canWrite: true,
      zambeelPerms: [...ZAMBEEL_ROLES] as ZambeelDepartment[],
      paRole: "manager" as ProductAvailabilityRole | null,
      productListing: true,
      operations: true,
    };
  }

  const portalRole: PortalRole =
    permissions?.portal_role && isPortalRole(permissions.portal_role)
      ? permissions.portal_role
      : "manager";

  const department =
    permissions?.department ?? teamToDepartment(team) ?? null;

  const tabs = resolveLegacyTabs({ role, permissions });
  const paRole = tabs.product_availability ? resolvePaRole(permissions, role) ?? "agent" : null;

  return {
    portalRole,
    department,
    tabs,
    canWrite: portalRole === "manager" || portalRole === "admin",
    zambeelPerms: (permissions?.zambeel360 ??
      (role && isZambeelDepartment(role) ? [role] : [])) as ZambeelDepartment[],
    paRole,
    productListing: tabs.product_listing,
    operations: tabs.operations,
  };
}

export function hasMainTabAccess(
  tab: MainTab,
  input: {
    role?: UserRole | string | null;
    isAdmin?: boolean;
    permissions?: UserPermissions;
    team?: SignupTeam | string | null;
  },
): boolean {
  const effective = deriveEffectivePermissions(input);
  return effective.tabs[tab] === true;
}

export function hasZambeelAccess(input: {
  role?: UserRole | string | null;
  isAdmin?: boolean;
  permissions?: UserPermissions;
}): boolean {
  if (input.isAdmin) return true;
  const { zambeelPerms } = deriveEffectivePermissions(input);
  return zambeelPerms.length > 0;
}

export function formatZambeelPerms(perms: string[] | undefined): string {
  if (!perms?.length) return "None";
  return perms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
}

export function formatPaRole(role: string | null | undefined): string {
  if (!role) return "None";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatPortalRole(role: PortalRole | string | null | undefined): string {
  if (!role) return "None";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatPortalDepartment(
  department: PortalDepartment | string | null | undefined,
  team?: string | null,
): string {
  if (department) {
    return department
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  if (team && isSignupTeam(team)) return formatSignupTeamLabel(team);
  return "—";
}

export function formatMainTabs(tabs: MainTabAccess): string {
  const labels: string[] = [];
  if (tabs.operations) labels.push("Operations");
  if (tabs.product_availability) labels.push("Product Availability");
  if (tabs.product_listing) labels.push("Product Listing");
  if (tabs.admin_users) labels.push("Admin Users");
  return labels.length > 0 ? labels.join(", ") : "Home only";
}

export function isProductAvailabilityAdminViewer(role: string | null | undefined): boolean {
  return (role ?? "").toLowerCase() === "admin";
}

export type ProductAvailabilityDataScope = "all" | "own_requests" | "assigned" | "market";

export function getProductAvailabilityDataScope(
  role: string | null | undefined,
): ProductAvailabilityDataScope {
  const r = (role ?? "").toLowerCase();
  if (r === "admin") return "all";
  if (r === "purchaser") return "assigned";
  if (r === "manager") return "market";
  return "own_requests";
}

export function normalizeProductAvailabilityUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

export async function resolveProductAvailabilityOwnerIds(
  userEmail: string,
  db: SupabaseClient,
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
  team?: SignupTeam | string | null;
}): string {
  if (input.isAdmin) return "admin";
  const effective = deriveEffectivePermissions(input);
  if (!effective.tabs.product_availability) return "agent";
  return effective.paRole ?? "agent";
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

export const PORTAL_ROLE_OPTIONS: { value: PortalRole; label: string; hint: string }[] = [
  { value: "agent", label: "Agent", hint: "Read-only on allowed tabs" },
  { value: "manager", label: "Manager", hint: "Read and write on allowed tabs" },
  { value: "admin", label: "Admin", hint: "Full access including Admin Users" },
];

export const PORTAL_DEPARTMENT_OPTIONS: { value: PortalDepartment; label: string }[] = [
  { value: "growth", label: "Growth" },
  { value: "finance", label: "Finance" },
  { value: "operations", label: "Operations" },
  { value: "strategy", label: "Strategy" },
  { value: "partner_store", label: "Partner Store" },
];

export const MAIN_TAB_OPTIONS: { key: Exclude<MainTab, "home" | "admin_users">; label: string }[] = [
  { key: "operations", label: "Operations" },
  { key: "product_availability", label: "Product Availability" },
  { key: "product_listing", label: "Product Listing" },
];
