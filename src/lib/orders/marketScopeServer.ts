import { getCountryScopeFromSession } from "@/lib/portalCountryScope";
import { getPortalSession } from "@/lib/session";

/** Call only from Server Components / Route Handlers — not inside unstable_cache. */
export function marketScopeForCurrentRequest() {
  return getCountryScopeFromSession(getPortalSession());
}
