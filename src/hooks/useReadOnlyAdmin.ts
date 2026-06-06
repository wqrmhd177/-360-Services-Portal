"use client";

import { useEffect, useState } from "react";

export function useReadOnlyAdmin(): boolean {
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setReadOnly(!!data?.session?.isAdmin))
      .catch(() => setReadOnly(false));
  }, []);

  return readOnly;
}
