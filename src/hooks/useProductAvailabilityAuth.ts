"use client";

import { useEffect, useState } from "react";
import {
  deriveEffectivePermissions,
  parsePermissions,
  type ProductAvailabilityRole,
} from "@/lib/permissions";

export interface ProductAvailabilityAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Portal primary role (e.g. growth, agent) */
  userRole: string | null;
  /** Effective Product Availability role from permissions or primary PA role */
  paRole: ProductAvailabilityRole | null;
  isAdmin: boolean;
  /** Email address — used as the user identifier across all PA tables */
  userFriendlyId: string | null;
  email: string | null;
}

export function useProductAvailabilityAuth(): ProductAvailabilityAuthState {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [paRole, setPaRole] = useState<ProductAvailabilityRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.session) {
          const session = data.session;
          const permissions = parsePermissions(session.permissions);
          const effective = deriveEffectivePermissions({
            role: session.role,
            isAdmin: !!session.isAdmin,
            permissions,
          });

          setIsAuthenticated(true);
          setUserRole(session.role ?? null);
          setPaRole(effective.paRole);
          setIsAdmin(!!session.isAdmin);
          setEmail(session.email ?? null);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return {
    isAuthenticated,
    isLoading,
    userRole,
    paRole,
    isAdmin,
    userFriendlyId: email,
    email,
  };
}
