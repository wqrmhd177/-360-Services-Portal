"use client";

import { useEffect, useState } from "react";
import {
  parsePermissions,
  resolveFeatureAccess,
  type FeatureAccessLevel,
} from "@/lib/permissions";

export function useFeatureAccess(featureKey: string): {
  access: FeatureAccessLevel | null;
  loading: boolean;
  canWrite: boolean;
  canRead: boolean;
} {
  const [access, setAccess] = useState<FeatureAccessLevel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const session = data.session;
        if (!session) {
          setAccess("none");
          return;
        }
        const permissions = parsePermissions(session.permissions);
        setAccess(
          resolveFeatureAccess(featureKey, {
            role: session.role,
            isAdmin: !!session.isAdmin,
            permissions,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setAccess("none");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [featureKey]);

  return {
    access,
    loading,
    canWrite: access === "write",
    canRead: access === "read" || access === "write",
  };
}
