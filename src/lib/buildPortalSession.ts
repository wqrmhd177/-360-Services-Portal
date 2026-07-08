import type { PortalSession } from "./session";
import { parsePermissions } from "./permissions";
import type { UserRole } from "./simpleAuth";

const DEFAULT_VIEW_ROLE: UserRole = "growth";

export function buildPortalSession(profile: {
  email: string;
  full_name?: string | null;
  role: UserRole | string;
  permissions?: unknown;
}): PortalSession {
  const fullName = profile.full_name?.trim() || profile.email.split("@")[0] || "User";
  const permissions = parsePermissions(profile.permissions);

  if (profile.role === "admin") {
    return {
      email: profile.email,
      fullName,
      role: DEFAULT_VIEW_ROLE,
      isAdmin: true,
      permissions,
    };
  }

  return {
    email: profile.email,
    fullName,
    role: profile.role as UserRole,
    permissions,
  };
}
