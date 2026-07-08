"use client";

import { useEffect, useState } from "react";

export interface ProductAvailabilityAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: string | null;
  /** Email address — used as the user identifier across all PA tables */
  userFriendlyId: string | null;
  email: string | null;
}

export function useProductAvailabilityAuth(): ProductAvailabilityAuthState {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.session) {
          setIsAuthenticated(true);
          setUserRole(data.session.role ?? null);
          setEmail(data.session.email ?? null);
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
    userFriendlyId: email,
    email,
  };
}
