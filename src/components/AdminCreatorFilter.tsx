"use client";

import { useEffect, useState } from "react";
import CreatorFilterDropdown from "./CreatorFilterDropdown";

interface AdminCreatorFilterProps {
  value: string;
  onChange: (email: string) => void;
}

/** Creator filter shown only when the session user is admin. */
export default function AdminCreatorFilter({ value, onChange }: AdminCreatorFilterProps) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setIsAdmin(!!data?.session?.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  if (!isAdmin) return null;

  return <CreatorFilterDropdown value={value} onChange={onChange} />;
}
