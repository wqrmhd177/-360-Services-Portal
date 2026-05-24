import { cookies } from "next/headers";
import type { UserRole } from "./simpleAuth";

export interface PortalSession {
  email: string;
  fullName?: string;
  role?: UserRole;
  /** When true, user can switch roles and access all dashboards. */
  isAdmin?: boolean;
}

export function getPortalSession(): PortalSession | null {
  const raw = cookies().get("portal_session")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalSession;
  } catch {
    return null;
  }
}

