"use client";

import { useEffect, useState } from "react";
import {
  type AllowedCountriesConfig,
  resolveAllowedCountries,
} from "@/lib/portalCountryScope";
import { parsePermissions } from "@/lib/permissions";
import type { PortalSession } from "@/lib/session";

type SessionResponse = {
  session: PortalSession | null;
  countryScope?: AllowedCountriesConfig;
};

export function useAllowedCountries(): {
  allowed: AllowedCountriesConfig;
  loading: boolean;
} {
  const [allowed, setAllowed] = useState<AllowedCountriesConfig>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data: SessionResponse) => {
        if (cancelled) return;
        if (data.countryScope) {
          setAllowed(data.countryScope);
        } else if (data.session) {
          setAllowed(
            resolveAllowedCountries({
              isAdmin: data.session.isAdmin,
              permissions: parsePermissions(data.session.permissions),
            }),
          );
        } else {
          setAllowed("all");
        }
      })
      .catch(() => {
        if (!cancelled) setAllowed("all");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowed, loading };
}
