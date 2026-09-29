import { cache } from "react";
import { parsePermissions } from "@/lib/permissions";
import {
  getCountryScopeFromSession,
  resolveAllowedCountries,
  type AllowedCountriesConfig,
} from "@/lib/portalCountryScope";
import { getPortalSession } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";

/** Reads latest `permissions.allowedCountries` from the profile (not only the login cookie). */
export const getFreshCountryScope = cache(async (): Promise<AllowedCountriesConfig> => {
  const session = getPortalSession();
  if (!session?.email) return "all";
  if (session.isAdmin) return "all";
  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("permissions, role")
      .ilike("email", session.email)
      .maybeSingle();
    if (data?.role === "admin") return "all";
    const permissions = parsePermissions(
      (data as { permissions?: unknown } | null)?.permissions ?? session.permissions,
    );
    return resolveAllowedCountries({ permissions });
  } catch {
    return getCountryScopeFromSession(session);
  }
});
